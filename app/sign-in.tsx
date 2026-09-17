import { useState } from "react";
import { router } from "expo-router";
import {
  backend,
  configured,
  authenticatedOwner,
  rpc,
} from "../src/auth/client";
import { Action, Copy, Field, Page } from "../src/components/ui";
import { write } from "../src/db/local";
import { logout } from "../src/location/lifecycle";
export default function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <Page title="Sign in">
      <Copy>
        Use your pre-created Turf account. Your Apple Account belongs only in
        SideStore. Signing into another account clears this installation’s
        previous unsynchronized data.
      </Copy>
      {!configured ? (
        <Copy>
          Backend not configured. Supply the public Supabase URL and publishable
          key, then rebuild.
        </Copy>
      ) : null}
      <Field label="Email" value={email} onChange={setEmail} />
      <Field label="Password" value={password} onChange={setPassword} secret />
      <Action
        title="Sign in"
        run={async () => {
          await logout();
          await write("auth_blocked", false);
          const { error } = await backend().auth.signInWithPassword({
            email: email.trim(),
            password,
          });
          if (error) throw new Error("AUTH_REQUIRED");
          await authenticatedOwner();
          await rpc("get_my_setup_state", {});
          setPassword("");
          router.replace("/tracking");
        }}
      />
      <Copy>
        No public registration. Ask the project administrator to reset a
        forgotten Turf password.
      </Copy>
    </Page>
  );
}
