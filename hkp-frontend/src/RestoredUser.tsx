import { IdToken, useAuth0 } from "@auth0/auth0-react";

type Props = {
  onToken: (claims: IdToken) => void;
};

export default function RestoredUser({ onToken }: Props) {
  const { getIdTokenClaims, isLoading, isAuthenticated, logout } = useAuth0();
  const onRestore = async () => {
    if (!isLoading && isAuthenticated) {
      const idToken: IdToken | undefined = await getIdTokenClaims();
      if (idToken) {
        try {
          await onToken(idToken);
        } catch (err: any) {
          if (err.message === "token expired") {
            await logout({ openUrl: false });
            throw err;
          } else {
            console.log("AppContext.updateToken() unknown error ", err);
            throw err;
          }
        }
      }
    }
  };

  onRestore();
  return null;
}
