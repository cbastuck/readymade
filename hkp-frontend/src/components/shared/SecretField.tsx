import InputField, {
  Props as InputFieldProps,
} from "@/components/shared/InputField";
import { useVault } from "@/vault";

type Props = InputFieldProps & {
  fallbackValue?: string;
};
export default function SecretField(props: Props) {
  const { value, fallbackValue, onChange, ...rest } = props;

  const [vaultId, instanceId, key] = value?.split(".") || [];
  const vault = useVault(vaultId as "uservault"); // TODO:

  const secret = (vault && vault.get(instanceId, key)) || "";

  const onChangeSecret = (value: string) => {
    if (vault) {
      vault.set(instanceId, key, value);
      vault.save();
    }

    onChange?.(value);
  };

  return (
    <InputField
      {...rest}
      value={secret}
      type="password"
      onChange={onChangeSecret}
    />
  );
}
