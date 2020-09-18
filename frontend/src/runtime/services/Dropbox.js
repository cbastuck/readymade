import { Dropbox as DBox } from 'dropbox';

const clientId = '1gederbui19m8pk';
const redirectURI = 'http://localhost/serviceRedirect';

export default class Dropbox {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.mode = 'download';
    this.dbx = new DBox({ clientId, fetch });
  }

  configure(config) {
    const { 
      accessToken,
      mode,
    } = config;

    if (accessToken !== undefined) {
      this.dbx.setAccessToken(accessToken);
    }

    if (mode !== undefined) {
      this.mode = mode;
    }
  }

  getAuthUrl(state) {
    return this.dbx.getAuthenticationUrl(redirectURI, state);
  }

  getUserAccount() {
    return this.dbx.usersGetCurrentAccount();
  }

  async retrieveFiles() {
    const response = await this.dbx.filesListFolder({ path: '' });
    return response.entries;
  }

  async trigger(params) {
    const data = await this.process(params);
    await this.app.next(this, data);
  }

  async downloadFile(fn) {
    const files = await this.retrieveFiles();
    const file = files.find(f => f.name === fn);
    if (file) {
      return this.dbx.filesDownload({ path: file.path_lower });
    }
  }

  async processDownload(params) {
    const file = params && params.file;
    if (file) {
      const f = await this.downloadFile(file);
      return f.fileBlob.text();
    } else {
      console.log('Dropbox bypass param in download mode', params);
    }
  }

  async processUpload(params) {
    const args = { 
      commit_info: {
        path: '/testpath.txt',
        autorename: true, 
        mode: { '.tag': 'add' }
      }
    };
    const uploadLink = await this.dbx.filesGetTemporaryUploadLink(args);
    const response = await fetch(
      uploadLink.link,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body: JSON.stringify(params)
      }
    );
    console.log('Upload link ',uploadLink, response);
    return params;
  }

  async process(params) {
    if (!this.dbx.getAccessToken()) {
      return params;
    }

    if (this.mode === 'download') {
      return this.processDownload(params);
    } else if (this.mode === 'upload') {
      return this.processUpload(params);
    } else {
      console.log('Unknown dropbox mode', this.mode);
    }
  
    return params;
  }
}
