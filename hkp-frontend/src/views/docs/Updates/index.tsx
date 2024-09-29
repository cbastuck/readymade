import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui-components/primitives/table";

import Text from "@/ui-components/Text";
import NewsItem from "./NewsItem";

import Template from "../../Template";
import Button from "@/ui-components/Button";

export default function Updates() {
  const navigate = useNavigate();
  return (
    <Template title="What's new">
      <Table className="mt-8">
        <TableHeader>
          <TableRow>
            <TableHead className="font-sans text-xl w-[33%]">Update</TableHead>
            <TableHead className="font-sans text-xl w-[33%]">State</TableHead>
            <TableHead className="font-sans text-xl w-[33%]">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
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
        style={{ marginBottom: "50px", width: "100%" }}
      >
        Next: Starter's Tutorial
      </Button>
    </Template>
  );
}
