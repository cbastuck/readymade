import { Link, useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "hkp-frontend/src/ui-components/primitives/table";

import Text from "hkp-frontend/src/ui-components/Text";
import NewsItem from "./NewsItem";

import Template from "../../Template";
import Button from "hkp-frontend/src/ui-components/Button";

export default function Updates() {
  const navigate = useNavigate();
  return (
    <Template title="What's new">
      <Table className="mt-8">
        <TableHeader>
          <TableRow>
            <TableHead className="font-sans text-xl w-[25%]">Date</TableHead>
            <TableHead className="font-sans text-xl w-[55%]">Update</TableHead>
            <TableHead className="font-sans text-xl w-[20%]">State</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <NewsItem
            date="1.11.2024"
            content={
              <Text>
                <Link to="/docs/tutorials/starter">
                  {" "}
                  On-Boarding Tutorial - Leave Lamp
                </Link>
              </Text>
            }
          />
          <NewsItem
            date="29.9.2024"
            content={
              <Text>
                Preview version{" "}
                <a href="https://hookitapp.com">hookitapp.com</a>
              </Text>
            }
          />
        </TableBody>
      </Table>
      <Button
        onClick={() => navigate("/docs/tutorials/starter")}
        className="my-10 w-full"
      >
        Next: On-Boarding Tutorial
      </Button>
    </Template>
  );
}
