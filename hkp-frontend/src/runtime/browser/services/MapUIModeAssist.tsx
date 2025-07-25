import JSONCode from "hkp-frontend/src/ui-components/JSONCode";
import SimpleTable from "hkp-frontend/src/ui-components/SimpleTable";

export default function MapUIModeAssist() {
  return (
    <div className="flex flex-col font-serif text-[14px] tracking-wider overflow-y-scroll">
      <div className="mb-4">
        The Mode service supports the following three modes:
      </div>
      <div className="w-[80%] px-8">
        <SimpleTable
          columns={["Mode", "Behavior"]}
          rows={[
            [
              "Replace",
              "Replaces the whole incoming data with the defined mapping.",
            ],
            [
              "Overwrite",
              "Overwrites properties of the incoming data, with the defined mapped, if the property in the incoming data as well.",
            ],
            [
              "Add",
              "Never overwrites properties from the incoming data, but adds the defined mapped properties to the incoming data.",
            ],
          ]}
        />
      </div>
      <div className="flex flex-col gap-2 py-6 font-serif text-[14px] w-[80%]">
        <div>
          Typically you use the Map service to adapt incoming, structured JSON
          data, to generate a different shape. By this you can select, remove
          others, or rename properties freely. You do this by defining mapping
          properties. Each mapping row defines a property that will be part in
          the transformed data.
        </div>
        <div>
          With the three modes you are able to control the way how incoming
          properties are handled on conflicts. Note that you can add dynamic and
          static mappings. The key of a dynamic mapping must end with a `=`
          sign. Further you can access the incomging data via the variable name
          `params`. For example,
          <SimpleTable
            className="w-[50%] m-auto"
            columns={["Key", "Value"]}
            rows={[
              ["dynamicValue=", "params.name + params.age"],
              ["staticValue", "42"],
            ]}
          />
          <div className="flex flex-col gap-4 mt-2">
            For the following incoming data:{" "}
            <JSONCode value={{ name: "Edgar", age: 42 }} />
            the Map service will generate the following output data:
            <JSONCode value={{ dynamicValue: "Edgar42", staticValue: 42 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
