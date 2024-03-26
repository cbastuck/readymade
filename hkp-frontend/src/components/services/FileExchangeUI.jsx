import { Component } from "react";
import { Input, Button } from "semantic-ui-react";

import { configureService, getServiceConfiguration } from "../../core/actions";

export default class FileExchangeUI extends Component {
  state = {
    uploadName: undefined,
    availableDownloads: undefined,
  };

  componentDidMount() {
    this.syncConfiguration();
  }

  syncConfiguration = async () => {
    const { board, service } = this.props;
    const config = await getServiceConfiguration(board, service);
    if (config.files) {
      this.setState({ availableDownloads: Object.keys(config.files) });
    }
  };

  onNameChanged = (name) => {
    if (this.changeNameTimer) {
      clearTimeout(this.changeNameTimer);
      this.changeNameTimer = undefined;
    }
    this.setState({ uploadName: name });
    this.changeNameTimer = setTimeout(() => {
      this.updateExchangeName(name);
      this.changeNameTimer = undefined;
    }, 1000);
  };

  updateExchangeName = (name) => {
    const { board, service } = this.props;
    return configureService(board, service, { name });
  };

  render() {
    const { service } = this.props;
    const lineStyle = {
      textAlign: "left",
      marginBottom: 10,
    };

    return (
      <div>
        <div
          style={{
            ...lineStyle,
            textAlign: "center",
          }}
        >
          <form
            action={`/api/${service.board}/${this.state.uploadName}`}
            method="post"
            encType="multipart/form-data"
          >
            <Input
              style={{ width: "100%" }}
              type="file"
              name="file"
              onChange={(_, data) => {
                const filePath = data.value.split("\\");
                const fileName = filePath[filePath.length - 1];
                this.onNameChanged(fileName);
              }}
            />
            <div
              style={{
                ...lineStyle,
                textAlign: "center",
              }}
            >
              <Button
                type="submit"
                style={{
                  width: 210,
                  marginTop: 10,
                }}
                disabled={!this.state.uploadName}
              >
                Upload
              </Button>
            </div>
          </form>
        </div>
        <div
          style={{
            ...lineStyle,
            textAlign: "center",
          }}
        >
          <a
            href={`/api/${service.board}/${
              this.state.availableDownloads && this.state.availableDownloads[0]
            }`}
            target="blank"
          >
            <Button
              style={{
                width: 210,
              }}
              disabled={
                !this.state.availableDownloads ||
                this.state.availableDownloads.length === 0
              }
              onClick={() => setTimeout(this.syncConfiguration, 1000)}
            >
              Download
            </Button>
          </a>
        </div>
      </div>
    );
  }
}
