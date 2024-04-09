import { ReactElement } from "react";
import { List } from "semantic-ui-react";
import moment from "moment";

import Date from "../../../components/Date";

type Props = {
  content: ReactElement;
  date: string;
};
export default function NewsItem({ content, date }: Props) {
  const d = moment(date, "D.M.YYYY");
  const month = d.format("MMMM");
  const day = d.format("DD");
  const year = d.year().toString();
  return (
    <List.Item style={{ margin: "5px 0px" }}>
      <List.Content>
        <List.Header style={{ fontWeight: "normal" }}>
          <div className="hkp-fnt-family">{content}</div>
        </List.Header>
      </List.Content>
      <div style={{ marginTop: "5px" }}>
        <Date month={month} day={day} year={year} size="m" />
      </div>
    </List.Item>
  );
}
