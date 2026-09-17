import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Action, Copy, Field, Page } from "../src/components/ui";
import { rpc } from "../src/auth/client";
import { pause } from "../src/location/lifecycle";
import { safeError } from "../src/domain/model";
export default function Pairing() {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("");
  const [invite, setInvite] = useState("");
  const refresh = useCallback(async () => {
    const s = await rpc("get_my_setup_state", {});
    setStatus(s.pair?.status ?? "Not paired");
  }, []);
  useFocusEffect(
    useCallback(() => {
      void refresh().catch((e) => setStatus(safeError(e)));
    }, [refresh]),
  );
  return (
    <Page title="Your private pair">
      <Copy>{status}</Copy>
      <Copy>
        Only the other allowlisted account can join. The six-character code
        expires after 24 hours and can be used once.
      </Copy>
      <Action
        title="Create / replace invite"
        run={async () => {
          const result = await rpc("create_pair_invite", {});
          setInvite(
            result.invite_code
              ? `${result.invite_code}\nExpires ${result.expires_at}`
              : (result.code ?? "Request failed"),
          );
          await refresh();
        }}
      />
      <Copy>{invite}</Copy>
      <Field label="Invite code" value={code} onChange={setCode} />
      <Action
        title="Join pair"
        run={async () => {
          const result = await rpc("join_pair", {
            code: code.trim().toUpperCase(),
          });
          setStatus(result.code);
          if (result.code === "OK") {
            setCode("");
            await refresh();
          }
        }}
      />
      <Action title="Refresh pair status" run={refresh} />
      <Action
        title="Unpair and stop my capture"
        run={async () => {
          await pause("unpaired");
          await rpc("end_my_pair", {});
          setInvite("");
          await refresh();
        }}
      />
    </Page>
  );
}
