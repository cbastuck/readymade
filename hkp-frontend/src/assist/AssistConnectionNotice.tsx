import type { NewAddresses } from "./addresses";

/**
 * Asks before a proposal makes the board contact addresses it did not use
 * before. See `addresses.ts` for why this is not left to the diff alone.
 */
export default function AssistConnectionNotice({
  addresses,
  busy,
  onAccept,
  onCancel,
}: {
  addresses: NewAddresses;
  busy: boolean;
  onAccept: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="hkp-assist-confirm" role="alert">
      <strong>This proposal contacts new addresses</strong>
      {addresses.runtimes.length > 0 && (
        <>
          <p>
            Runtime servers. They run part of the board and receive your
            Readymade sign-in:
          </p>
          <ul>
            {addresses.runtimes.map((address) => (
              <li key={address}>
                <code>{address}</code>
              </li>
            ))}
          </ul>
          <p>
            A runtime that names a server you keep, such as{" "}
            <code>"remote": "node"</code>, needs no confirmation. Add the
            server to your remotes and ask the assistant to use its name.
          </p>
        </>
      )}
      {addresses.services.length > 0 && (
        <>
          <p>Addresses services will connect to and may send board data to:</p>
          <ul>
            {addresses.services.map((address) => (
              <li key={address}>
                <code>{address}</code>
              </li>
            ))}
          </ul>
        </>
      )}
      <p>Apply only if you know and trust them.</p>
      <div className="hkp-assist-row">
        <button type="button" disabled={busy} onClick={onCancel}>
          Don't apply
        </button>
        <button type="button" disabled={busy} onClick={onAccept}>
          Trust and apply
        </button>
      </div>
    </div>
  );
}
