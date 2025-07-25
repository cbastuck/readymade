import { useState } from "react";

import Text from "hkp-frontend/src/ui-components/Text";
import { s, t } from "../../styles";
import CustomDialog from "hkp-frontend/src/ui-components/CustomDialog";

type Props = {
  value: string | string[];
};

type RefDatamodel = {
  link: string;
  name: string;
};

export default function Explanation({ value: explanation }: Props) {
  const [modalReferenceDatamodel, setModalReferenceDatamodel] = useState<
    RefDatamodel | undefined
  >(undefined);
  if (!explanation) {
    return false;
  }

  const component = <div />;

  return (
    <div
      className="font-serif tracking-widest"
      style={s(t.m(0, 10), {
        width: "95%",
        textTransform: "none",
      })}
    >
      {assureArray(explanation).map((exp, eidx) => (
        <Text key={`explanation-${eidx}`} style={{ marginTop: 3 }}>
          {Array.from(tokenize(exp)).map((p, idx) =>
            typeof p === "string" ? (
              <span key={`example-explanation-part-${idx}`}>{p}</span>
            ) : (
              <span
                key={`example-explanation-part-${idx}`}
                style={{
                  color: "#4183c4",
                  cursor: "pointer",
                  fontStyle: "italic",
                }}
                onClick={() => setModalReferenceDatamodel(p)}
              >
                {` ${p.name} `}
              </span>
            )
          )}
        </Text>
      ))}
      <CustomDialog
        title={""}
        //component={component}
        //url={modalReferenceDatamodel ? modalReferenceDatamodel.link : ""}
        onOpenChange={(open: boolean) =>
          !open && setModalReferenceDatamodel(undefined)
        }
        isOpen={!!modalReferenceDatamodel}
      >
        <div className="h-full w-full overflow-auto">{component}</div>
      </CustomDialog>
    </div>
  );
}

function assureArray(stringOrArray: string | Array<string>) {
  return Array.isArray(stringOrArray) ? stringOrArray : [stringOrArray];
}

function* tokenize(str: string) {
  if (!str) {
    return "";
  }

  let spos = 0;
  while (spos < str.length) {
    const begin = str.indexOf("[", spos);
    if (begin === -1) {
      yield str.substr(spos);
      return;
    }

    if (begin > spos) {
      yield str.substr(spos, begin - spos);
      spos = begin;
    }

    const end = str.indexOf(")", begin + 1);
    if (end !== -1) {
      const nameEnd = str.indexOf("]", begin + 1);
      const linkBegin = str.indexOf("(", nameEnd + 1);
      if (linkBegin !== -1 && nameEnd !== -1) {
        yield {
          type: "link",
          name: str.substr(begin + 1, nameEnd - begin - 1),
          link: str.substr(linkBegin + 1, end - linkBegin - 1),
        };
      }
    } else {
      // syntax error: closing bracket missing
      yield str.substr(spos);
      return;
    }
    spos = end + 1;
  }
}
