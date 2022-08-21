import { Message } from "semantic-ui-react";

const Info = ({ headline, children }) => (
  <Message info>
    {headline && <Message.Header>{headline} </Message.Header>}
    <p>{children}</p>
  </Message>
);

export default Info;
