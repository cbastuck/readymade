import { ReactElement } from "react";
import { List, Icon } from "semantic-ui-react";

type Props = {
  content: ReactElement;
  date: string;
};
export default function NewsItem({ content, date }: Props) {
  return (
    <List.Item style={{ margin: "5px 0px" }}>
      <List.Icon size="large" verticalAlign="middle">
        <Icon name="circle outline" size="small" />
      </List.Icon>
      <List.Content>
        <List.Header style={{ fontWeight: "normal" }}>{content}</List.Header>
        <List.Description>{date}</List.Description>
      </List.Content>
    </List.Item>
  );
}
