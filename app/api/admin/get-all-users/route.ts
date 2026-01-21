import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { headers } from 'next/headers';

// Mark this route as dynamic since it uses headers()
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // Get the current user ID from the custom header sent by the client
    const headersList = await headers();
    const currentUserId = headersList.get('x-user-id');

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Use server client to check if current user is site admin
    const serverClient = createServerClient();
    const { data: userCountries, error: userCountriesError } = await serverClient
      .from('user_countries')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('role', 'admin')
      .limit(1);

    if (userCountriesError || !userCountries || userCountries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Only site administrators can view all users' },
        { status: 403 }
      );
    }

    // Get all users from auth.users using server client with service role
    // Note: listUsers() may paginate, so we need to fetch all pages
    let allUsers: any[] = [];
    let page = 1;
    const perPage = 1000; // Supabase default is 50, but we can request up to 1000
    
    while (true) {
      const { data: { users }, error: usersError } = await serverClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (usersError) {
        throw usersError;
      }

      if (!users || users.length === 0) {
        break; // No more users
      }

      allUsers = allUsers.concat(users);

      // If we got fewer users than requested, we've reached the end
      if (users.length < perPage) {
        break;
      }

      page++;
    }

    // Get all user_countries assignments
    const { data: userCountriesData, error: userCountriesDataError } = await serverClient
      .from('user_countries')
      .select(`
        id,
        user_id,
        country_id,
        role,
        country:countries(id, iso_code, name)
      `);

    if (userCountriesDataError) {
      throw userCountriesDataError;
    }

    // Combine users with their country assignments
    const usersWithAccess = allUsers.map((user: any) => {
      const assignments = (userCountriesData || []).filter((uc: any) => uc.user_id === user.id);
      const userCountries = assignments.map((uc: any) => ({
        id: uc.id,
        country_id: uc.country_id,
        role: uc.role,
        country: uc.country,
      }));

      const isSiteAdmin = userCountries.some((uc: any) => uc.role === 'admin');

      // Extract name from user metadata (could be in user_metadata or raw_user_meta_data)
      const metadata = user.user_metadata || user.raw_user_meta_data || {};
      const fullName = metadata.full_name || metadata.name || metadata.display_name || null;

      return {
        id: user.id,
        email: user.email || `user-${user.id.slice(0, 8)}@...`,
        full_name: fullName,
        created_at: user.created_at,
        user_countries: userCountries,
        isSiteAdmin,
      };
    });

    console.log(`API: Returning ${usersWithAccess.length} users`);

    return NextResponse.json({
      success: true,
      users: usersWithAccess,
    });
  } catch (err: any) {
    console.error('Error fetching all users:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch users' },
      { status: 500 }
    );
  }
}
