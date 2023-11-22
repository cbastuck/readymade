import { IdToken, useAuth0 } from "@auth0/auth0-react";

type Props = {
  onToken: (claims: IdToken) => void;
};

export default function RestoredUser({ onToken }: Props) {
  const { getIdTokenClaims, isLoading, isAuthenticated } = useAuth0();
  if (!isLoading && isAuthenticated) {
    getIdTokenClaims().then((idToken: IdToken | undefined) => {
      idToken && onToken(idToken);
    });
  }
  return null;
}
