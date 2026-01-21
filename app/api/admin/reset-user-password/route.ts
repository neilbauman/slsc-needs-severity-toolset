import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabaseServer';
import { headers } from 'next/headers';

// Mark this route as dynamic since it uses headers()
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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

    const body = await req.json();
    const { targetUserId, newPassword, sendResetEmail } = body;

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'Target user ID is required' },
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
        { success: false, error: 'Only site administrators can reset user passwords' },
        { status: 403 }
      );
    }

    // Get the user first to access their email
    const { data: { user }, error: getUserError } = await serverClient.auth.admin.getUserById(targetUserId);
    
    if (getUserError || !user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.email) {
      return NextResponse.json(
        { success: false, error: 'User does not have an email address' },
        { status: 400 }
      );
    }

    if (sendResetEmail) {
      // Send password reset email using Supabase's built-in recovery email
      const { error: resetError } = await serverClient.auth.admin.generateLink({
        type: 'recovery',
        email: user.email,
        options: {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'https://slsc-needs-severity-toolset.vercel.app'}/`,
        },
      });

      if (resetError) {
        throw resetError;
      }

      // Note: Supabase automatically sends the password reset email when generateLink is called with type 'recovery'

      return NextResponse.json({
        success: true,
        message: `Password reset email sent successfully to ${user.email}`,
      });
    } else {
      // Set new password directly
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters long' },
          { status: 400 }
        );
      }

      const { data: updatedUser, error: updateError } = await serverClient.auth.admin.updateUserById(
        targetUserId,
        {
          password: newPassword,
        }
      );

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully',
      });
    }
  } catch (err: any) {
    console.error('Error resetting password:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to reset password' },
      { status: 500 }
    );
  }
}
