import { Message } from "semantic-ui-react";

type Props = {
  headline: string;
  children: JSX.Element | JSX.Element[];
};

export default function Info({ headline, children }: Props) {
  return (
    <Message info>
      {headline && <Message.Header>{headline} </Message.Header>}
      <p>{children}</p>
    </Message>
  );
}
