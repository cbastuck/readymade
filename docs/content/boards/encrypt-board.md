# Encrypt / Decrypt

Two independent runtimes, one encrypting and one decrypting, sharing nothing but
a passphrase you type into both. The smallest board that shows a runtime is a
boundary and not just a list.

## What it does

Type text in the Encrypt panel and see the AES ciphertext. Paste ciphertext into
the Decrypt panel, give it the same secret, and get the text back.

## How it works

Two [browser runtimes](../concepts/runtime.md).

**Encrypt** — [Injector](../services/injector.md) takes the input,
[Encrypt](../services/encrypt.md) applies AES with the configured secret, and
[Monitor](../services/monitor.md) shows the result.

**Decrypt** — [Decrypt](../services/decrypt.md) reverses it with its own copy of
the secret, and a [Monitor](../services/monitor.md) shows the plaintext.

## Why they are separate

Nothing connects the two. The second runtime does not receive the first one's
output; you carry the ciphertext across by hand, which is the point — it
demonstrates that the ciphertext is all that is needed, and that the secret is
configured independently at each end rather than travelling with the message.

Set the two secrets differently and decryption fails, which is the correct
behaviour and worth seeing once.

## The facade

Two panels, Encrypt and Decrypt, each with a text input for the message, a text
input for the secret, and a line of text for the result.
