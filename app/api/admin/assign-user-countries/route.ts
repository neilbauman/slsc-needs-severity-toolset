import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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
        { success: false, error: 'Only site administrators can assign countries' },
        { status: 403 }
      );
    }

    // Get the target user email from request body
    const body = await request.json();
    const targetEmail = body.email;

    if (!targetEmail) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Get user ID from email using auth.admin.listUsers
    const { data: { users }, error: usersError } = await serverClient.auth.admin.listUsers();
    
    if (usersError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch users: ${usersError.message}` },
        { status: 500 }
      );
    }

    const usersList: any[] = users || [];
    const foundUser = usersList.find((u: any) => u.email === targetEmail);
    
    if (!foundUser) {
      return NextResponse.json(
        { success: false, error: `User with email ${targetEmail} not found` },
        { status: 404 }
      );
    }

    const userId = foundUser.id;

    // Get all active countries
    const { data: countries, error: countriesError } = await serverClient
      .from('countries')
      .select('id')
      .eq('active', true);

    if (countriesError) {
      return NextResponse.json(
        { success: false, error: `Failed to fetch countries: ${countriesError.message}` },
        { status: 500 }
      );
    }

    // Assign user to all countries as admin
    const assignments = (countries || []).map(country => ({
      user_id: userId,
      country_id: country.id,
      role: 'admin' as const,
    }));

    if (assignments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No active countries found' },
        { status: 404 }
      );
    }

    // Insert assignments (use upsert to handle conflicts)
    const { error: insertError } = await serverClient
      .from('user_countries')
      .upsert(assignments, {
        onConflict: 'user_id,country_id',
      });

    if (insertError) {
      return NextResponse.json(
        { success: false, error: `Failed to assign countries: ${insertError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Assigned ${assignments.length} countries to ${targetEmail}`,
      countries_assigned: assignments.length,
    });
  } catch (error: any) {
    console.error('Error assigning countries:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
