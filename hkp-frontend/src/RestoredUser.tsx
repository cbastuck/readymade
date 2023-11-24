import { IdToken, useAuth0 } from "@auth0/auth0-react";

type Props = {
  onToken: (claims: IdToken) => void;
};

export default function RestoredUser({ onToken }: Props) {
  const { getIdTokenClaims, isLoading, isAuthenticated } = useAuth0();
  const onRestore = async () => {
    if (!isLoading && isAuthenticated) {
      const idToken: IdToken | undefined = await getIdTokenClaims();
      if (idToken) {
        onToken(idToken);
      }
    }
  };

  onRestore();
  return null;
}
