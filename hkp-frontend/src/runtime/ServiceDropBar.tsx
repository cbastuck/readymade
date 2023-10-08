import { Component } from "react";

type Props = {
  index: number;
  onDrop: (svcUuid: string, pos: number) => void;
};

type State = {
  active: boolean;
};

export default class ServiceDropBar extends Component<Props, State> {
  state = {
    active: false,
  };

  render() {
    const { active } = this.state;
    const { onDrop, index } = this.props;
    return (
      <div
        style={{
          width: 20,
          height: "94%",
          margin: "10px 0px",
          borderRadius: 3,
          background: active
            ? "linear-gradient(to right, #fff 0%, #fff 40%, #4183c4 50%, #fff 60%)"
            : undefined,
        }}
        onDragOver={(ev) => {
          this.setState({ active: true });
          ev.preventDefault();
        }}
        onDragLeave={(ev) => this.setState({ active: false })}
        onDrop={(ev) => {
          this.setState({ active: false });
          const data = ev.dataTransfer.getData("text/plain");
          if (data) {
            const svc = JSON.parse(data);
            onDrop && onDrop(svc.uuid, index);
          }
        }}
      />
    );
  }
}
