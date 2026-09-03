import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
      // Needed for password-recovery links: resetPasswordForEmail only generates
      // and stores the PKCE code_verifier locally when flowType is "pkce" — without
      // it, exchangeCodeForSession on the /reset-password page (see that file) has
      // nothing to exchange the emailed `?code=` against, and the reset silently
      // fails at the final "set new password" step even though the email itself
      // sends fine. The rest of the app (password sign-in, signup OTP) doesn't
      // involve a redirect link, so this doesn't affect it.
      flowType: "pkce",
    },
  }
);
