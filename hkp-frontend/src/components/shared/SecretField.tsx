import InputField, {
  Props as InputFieldProps,
} from "hkp-frontend/src/components/shared/InputField";
import { secretReference } from "hkp-frontend/src/core/secrets";
import { vaultGet, vaultSet } from "hkp-frontend/src/vault";

type Props = Omit<InputFieldProps, "value"> & {
  /**
   * The name this secret is stored under. A service's own fields are named
   * `<serviceUuid>.<field>`, which keeps two services holding the same kind of
   * credential apart.
   */
  alias: string;
};

/**
 * Entry for a value that must not reach the board.
 *
 * What is typed goes to the vault; what the service is configured with is the
 * *reference* to it. That is the whole of the exchange — a service holding a
 * reference reports one from `getState`, so a board saved afterwards names the
 * secret and does not carry it.
 */
export default function SecretField({ alias, onChange, ...rest }: Props) {
  const onChangeSecret = (value: string) => {
    vaultSet(alias, value);
    onChange?.(secretReference(alias));
  };

  return (
    <InputField
      {...rest}
      value={vaultGet(alias) ?? ""}
      type="password"
      onChange={onChangeSecret}
    />
  );
}
