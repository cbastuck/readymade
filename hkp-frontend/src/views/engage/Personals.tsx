import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "hkp-frontend/src/ui-components/primitives/card";
import { Input } from "hkp-frontend/src/ui-components/primitives/input";
import { Label } from "hkp-frontend/src/ui-components/primitives/label";
import Text from "hkp-frontend/src/ui-components/Text";

export type PersonalData = {
  firstName: string;
  email: string;
};

type Props = {
  data: PersonalData;
  onChange: (updated: PersonalData) => void;
};

const emailRegex = /[a-zA-Z0-9.-_]{1,}@[a-zA-Z.-]{2,}[.]{1}[a-zA-Z]{2,}/;

export default function Personals({ data, onChange }: Props) {
  const { firstName, email } = data;
  const emailIsValid = !email || email.match(emailRegex);
  return (
    <Card className="w-full">
      <CardHeader className="my-4 py-0">
        <CardTitle className="tracking-widest">Join the project</CardTitle>
        <CardDescription className="mt-2 flex flex-col">
          <Text>
            Sign up to the newsletter, if you would like to get more in touch
            with the project, use it for your personal ideas, or contribute, or
            just want to stay up to date. Currently, I'm on close to releasing a
            first public version of my Go-based GraphQL-enabled remote runtime.
            It allows creating more complex and advanced boards and workflows.
            Soon, this will be available to the public as a Docker image. If
            you're eager to be part of this journey and want to contribute,
            leave your contact info.
          </Text>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="name">First Name or Nickname</Label>
            <Input
              id="name"
              className={email && !firstName ? "hkp-inp-error" : ""}
              placeholder=""
              value={firstName}
              onChange={(ev) =>
                onChange({ ...data, firstName: ev.target.value })
              }
            />
          </div>
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              className={
                !emailIsValid || (firstName && !email) ? "hkp-inp-error" : ""
              }
              type="text"
              value={email}
              onChange={(ev) => onChange({ ...data, email: ev.target.value })}
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between"></CardFooter>
    </Card>
  );
}
