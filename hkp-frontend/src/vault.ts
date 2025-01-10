import { InstanceId } from "./types";

type Store = { [serviceId: string]: { [key: string]: string } };

export class Vault {
  store: Store = {};
  id: string;
  constructor(id: string, item: string) {
    this.store = JSON.parse(item);
    this.id = id;
  }

  get(instanceId: string, key: string) {
    return decrypt(this.store[instanceId]?.[key]);
  }

  set(instanceId: string, key: string, value: string) {
    this.store[instanceId] = this.store[instanceId] || {};
    this.store[instanceId][key] = encrypt(value);
  }
}

export function getVault(vaultId: "uservault") {
  const restoredData = localStorage.getItem(`hkp-vault-${vaultId}`);
  const vault = new Vault(vaultId, restoredData || "{}");
  return {
    set: vault.set.bind(vault),
    get: vault.get.bind(vault),
    save: () =>
      localStorage.setItem(
        `hkp-vault-${vault.id}`,
        JSON.stringify(vault.store)
      ),
  };
}

export function secretId(vaultId: "uservault", svc: InstanceId, key: string) {
  return `${vaultId}.${svc.uuid}.${key}`;
}

// TODO: real safety needed
const dummy = 200;
function encrypt(value: string) {
  return value
    .split("")
    .map((x: string) => String.fromCharCode(x.charCodeAt(0) + dummy))
    .join("");
}

function decrypt(value: string | undefined) {
  return value !== undefined
    ? value
        .split("")
        .map((x) => String.fromCharCode(x.charCodeAt(0) - dummy))
        .join("")
    : null;
}
