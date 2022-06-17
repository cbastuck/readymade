import React from "react";

import { Link, useNavigate } from "react-router-dom";
import { Item } from "semantic-ui-react";

import Sketch from "./Sketch";
import Template from "../Template";
import { s, t } from "../../styles";

export default function Quickstart() {
  const renderGroupItem = (item) => {
    const itemStyle = {
      width: "100%",
      marginBottom: 10,
      padding: 20,
      borderBottom: item.bottomDivider ? "solid 1px lightgray" : "none",
    };
    return (
      <Item style={itemStyle}>
        {
          <Item.Header
            style={{
              fontSize: 16,
              letterSpacing: 2,
              paddingTop: 9,
              marginLeft: 10,
              minWidth: 150,
              textTransform: "uppercase",
            }}
          >
            <Link to={`/docs/${item.title.toLowerCase()}`}>{item.title}</Link>
          </Item.Header>
        }
        <Item.Content style={{ marginLeft: 10 }}>
          <Item.Description>
            {item.details.map((detail, idx) => (
              <div
                key={`detail-${item.title}-${idx}`}
                style={{
                  fontSize: 15,
                  cursor: "default",
                  lineHeight: 1.5,
                }}
              >
                {detail}
              </div>
            ))}
          </Item.Description>
        </Item.Content>
      </Item>
    );
  };

  const renderClaim = (claim) => {
    return (
      <div
        style={{
          fontSize: 16,
          textAlign: "left",
          margin: "5px 30px",
          color: claim.c ? "black" : "#454f6d",
          letterSpacing: 1,
          lineHeight: 1.5,
        }}
      >
        <span style={{ textTransform: "uppercase" }}>{claim.s}</span>
        {claim.c ? ": " : ""}
        <span
          style={{
            fontStyle: "italic",
            color: "#454f6d",
            letterSpacing: 1.3,
          }}
        >
          {claim.link ? (
            <a href={claim.link} target="blank">
              {claim.c}
            </a>
          ) : (
            <span
              style={{
                color: "#4183c4",
              }}
            >
              {claim.c}
            </span>
          )}
        </span>
      </div>
    );
  };

  const renderQuickstart = () => {
    const sectionStyle = {
      fontSize: 16,
      textAlign: "left",
      textTransform: "uppercase",
      letterSpacing: 2,
    };

    return (
      <div>
        <h2 style={{ ...sectionStyle, margin: "30px 0px" }}>Etiquette</h2>
        <div style={{ marginBottom: 35 }}>
          {renderClaim({ s: "Please", c: "Make stupid things!" })}
          {renderClaim({
            s: "In particular",
            c: "“Dance to all the wrong songs”",
            link: "https://www.youtube.com/watch?v=NkAe30aEG5c",
            cite: "D. Sandstrom, D. Lyxzen, K. Steen, J. Brannstrom",
          })}
          {renderClaim({
            s: "Because",
            c: '"Da fehlen Rebellen, da fehlen Dilettanten”',
            link: "https://www.youtube.com/watch?v=58ShJinuHTg",
            cite: "Kapelle Petra",
          })}
          {renderClaim({
            s: "Acknowledge",
            c: "“Wir können alles. Und Alles können wir sein”",
            link: "https://www.youtube.com/watch?v=GLAHeIEzaC8",
            cite: "R. Sczimarkowsi, J. Windmeier, C. Knopp, M. Ebsen, C. Peter",
          })}
          {renderClaim({
            s: "Understand",
            c: "“Nur weil es dumm aussieht, muss es das nicht sein”",
            link: "https://www.youtube.com/watch?v=IIw1nP4KEHs",
            cite: " K. Hamann, N. Kolodziej ",
          })}
          {renderClaim({
            s: "With respect",
            c: '"To want more than is given to you”',
            link: "https://www.youtube.com/watch?v=xk2CvKcJnC4",
            cite: "G. Moakes, K. Okereke,  M. Tong, R. Lissackj",
          })}
          {renderClaim({
            s: "Knowing",
            c: "\"I can't do this all on my own”",
            link: "https://www.youtube.com/watch?v=SBl2l3GIFD4",
            cite: "Lazlo Bane",
          })}
        </div>
        <h1 style={s(t.tc, t.uc, t.ls1, t.fs12, t.it, { color: "#4183c4" })}>
          <span style={t.fs16}>Do. </span>
          <span style={t.fs20}>Be curious!</span>
          <a href="https://cbastuck.de" target="blank">
            <span style={t.fs9}> talk.</span>
          </a>
        </h1>

        <h2
          style={{
            ...sectionStyle,
            marginTop: 30,
            marginBottom: 20,
          }}
        >
          Stuff to know about
        </h2>
        <div
          style={s(t.uc, t.fs16, {
            textAlign: "left",
            fontFamily: "Roboto",
            textTransform: "none",
            lineHeight: 1.5,
          })}
        >
          <div style={{ marginBottom: 10 }}>
            There are three "things" you need to know. These are the basic
            building blocks that enable experimentation:
            <span style={s(t.bold, t.m(5, 0))}>Board, Runtime and Service</span>
          </div>
          <div>
            Think of a Board as a sheet of paper. Then, a Runtime is a single
            line on that paper and the Services are the words on a line.
            Together they tell a story or they create behavior.
          </div>
          <div style={{ padding: "8px 0px" }}>
            <Sketch />
          </div>
          <Item.Group link style={{ marginTop: 0, marginBottom: 0 }}>
            {renderGroupItem({
              title: "Board",
              details: [
                "A Board is the topmost building block. Everything happens on a board",
                "A Board is identified by a name",
                "A Board owns and manages an arbitrary number of runtimes",
                "A Board can run inside of the browser independently of a backend (Playground for example)",
                "A Board can also be managed by a remote backend which persists its state and requires the notion of a user",
                "A Board defines the topology of the runtimes: how they are organized and their order",
                "A Board is responsible for passing the output of a runtime to the next runtime",
              ],
              image: undefined,
              bottomDivider: true,
            })}
            {renderGroupItem({
              title: "Runtime",
              details: [
                "A Runtime belongs to exactly one board",
                "A Runtime's lifetime ends with the lifetime of its parent board",
                "A Runtime can run inside of the browser or on a remote machine",
                "Runtimes running in the browser can be mixed with remote runtimes on the same board",
                "A Runtime owns and manages an arbitrary number of services",
                "A Runtime accepts data on its input and passes it to its services",
                "A Runtime calls services in order from left to right propagating the incoming data",
                "A Runtime provides the result of the last service as its output",
              ],
              image: undefined,
              bottomDivider: true,
            })}
            {renderGroupItem({
              title: "Service",
              details: [
                "Services are (high level) abstractions of (complex) logic",
                "Services are supposed to feel simple and intuitive",
                "Services have an input and an output",
                "Services need a configuration that can be modified or retrieved at any time",
                "A Service configuration defines the mode of the service",
                "Services behave differently depending on their configuration",
                "A Service can generate data spontaneously and trigger a chain reaction",
                "A Service can also decide to stop further propagation",
              ],
              image: undefined,
            })}
          </Item.Group>
        </div>
      </div>
    );
  };

  const navigate = useNavigate();
  return (
    <Template title="Quickstarter" isRoot={false}>
      {renderQuickstart()}
      <div style={s(t.tc, t.mt10)}>
        <button
          className="button"
          onClick={() => navigate("/playground")}
          style={{
            fontSize: 11,
            textTransform: "uppercase",
          }}
        >
          Visit Playground
        </button>
      </div>
    </Template>
  );
}
