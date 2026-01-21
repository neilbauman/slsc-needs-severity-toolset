import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function POST(req: Request) {
  try {
    // Get the user ID from the request body (sent by client)
    const body = await req.json();
    const { email, password, sendInvite, currentUserId } = body;

    if (!currentUserId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Create server client for admin operations
    const serverClient = createServerClient();

    // Check if current user is site admin
    const { data: userCountries, error: userCountriesError } = await serverClient
      .from('user_countries')
      .select('role')
      .eq('user_id', currentUserId)
      .eq('role', 'admin')
      .limit(1);

    if (userCountriesError || !userCountries || userCountries.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Only site administrators can create users' },
        { status: 403 }
      );
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      );
    }

    // Check if user already exists first
    const { data: existingUsers } = await serverClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());

    if (existingUser) {
      // User already exists - return helpful info
      return NextResponse.json(
        { 
          success: false, 
          error: 'A user with this email address already exists',
          existingUserId: existingUser.id,
          existingUserEmail: existingUser.email,
        },
        { status: 400 }
      );
    }

    // Create the user using admin API
    const { data: newUser, error: createError } = await serverClient.auth.admin.createUser({
      email,
      password: password || undefined, // If no password, user will need to reset it
      email_confirm: sendInvite ? false : true, // If sending invite, don't auto-confirm
      user_metadata: {},
    });

    if (createError) {
      // Handle specific errors
      if (createError.message.includes('already registered') || createError.message.includes('already exists')) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'A user with this email address already exists. Please find them in the users list below and assign access.',
          },
          { status: 400 }
        );
      }
      throw createError;
    }

    // If sending invite, send the invitation email
    if (sendInvite && newUser.user) {
      const { error: inviteError } = await serverClient.auth.admin.inviteUserByEmail(email);
      if (inviteError) {
        console.error('Error sending invitation:', inviteError);
        // User is created, but invite failed - still return success
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.user?.id,
        email: newUser.user?.email,
      },
    });
  } catch (err: any) {
    console.error('Error creating user:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to create user' },
      { status: 500 }
    );
  }
}
