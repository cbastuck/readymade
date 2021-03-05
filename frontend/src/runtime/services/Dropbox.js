import { Dropbox as DBox } from 'dropbox';

const clientId = '1gederbui19m8pk';
const redirectURI = `${window.location.origin}/serviceRedirect`;

export default class Dropbox {
  constructor(app, board, descriptor, id) {
    this.uuid = id;
    this.board = board;
    this.app = app;

    this.mode = 'download';
    this.uploadBehavior = 'async'; // can also be 'sync'
    this.uploadFilename = 'unnamed upload';
    this.uploadActive = false;
    
    this.dbx = new DBox({ clientId, fetch });
    const accessToken = this.app.restoreServiceData(this.uuid, 'accessToken');
    this.configure({ accessToken });
  }

  configure(config) {
    const { 
      accessToken,
      mode,
      uploadBehavior,
      uploadFilename,
    } = config;

    if (accessToken !== undefined) {
      this.app.storeServiceData(this.uuid, 'accessToken', accessToken);
      this.dbx.setAccessToken(accessToken);
    }

    if (mode !== undefined) {
      this.mode = mode;
    }

    if (uploadBehavior !== undefined) {
      this.uploadBehavior = uploadBehavior;
    }

    if (uploadFilename !== undefined) {
      this.uploadFilename = uploadFilename;
    }
  }

  async logout() {
    this.app.removeServiceData(this.uuid, 'accessToken');
    if (this.dbx) {
      await this.dbx.authTokenRevoke();
      this.dbx = undefined;
    }
  }

  getAuthUrl(state) {
    return this.dbx.getAuthenticationUrl(redirectURI, state);
  }

  isLoggedIn() {
    return !!this.dbx.getAccessToken();
  }

  async getUserAccount() {
    if (this.isLoggedIn()) {
      try {
        return await this.dbx.usersGetCurrentAccount();
      } catch (err) {
        this.onError(err);
      }
    }
  }

  async retrieveFiles() {
    const response = await this.dbx.filesListFolder({ path: '' });
    return response.entries;
  }

  onError(err) {
    if (err.status === 401) {
      return this.onTokenExpired();
    }
    console.error('Dropbox Error:', err.status, err, this.uuid)
  }

  onTokenExpired() {
    this.dbx.setAccessToken('');
    this.app.removeServiceData(this.uuid, 'accessToken');
  }

  async trigger(params) {
    const data = await this.process(params);
    await this.app.next(this, data);
  }

  async downloadFileByName(params) {
    let file = params && params.file;
    if (!file) {
      const files = await this.retrieveFiles();
      file = files.find(f => f.path_lower === params);
    }
    if (file) {
      return this.downloadFileByPath(file);
    }
  }

  async downloadFileByPath(file) {
    const f = await this.dbx.filesDownload({ path: file.path_lower });
    const blob = f.fileBlob;
    return this.isTextContent ? blob.text() : blob;
  }

  paramsToBody(params) {
    if (params instanceof Blob) {
      return { body: params, length: params.size };
    }
    const s = JSON.stringify(params);
    return { body: s, length: s.length };
  }

  async processSyncUpload(filename, params) {
    const { body } = this.paramsToBody(params);

    const args = { 
      commit_info: {
        path: `/${filename}`,
        autorename: true, 
        mode: { '.tag': 'add' }
      }
    };
    const uploadLink = await this.dbx.filesGetTemporaryUploadLink(args);
    return fetch(
      uploadLink.link,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        body
      }
    );
  }

  finishUpload() {
    if (!this.uploadSession) {
      console.log('There is no upload session active');
      return;
    }
    this.dbx.filesUploadSessionFinish({
      cursor: {
        session_id: this.uploadSession.session_id,
        offset: this.uploadSessionOffset,
      },
      commit: {
        path: `/${this.uploadFilename}`,
        mode: { '.tag': 'add' },
        autorename: true,
      },
    });
    this.uploadSessionOffset = 0;
    this.uploadSession = undefined;
  }

  async processAsyncUpload(filename, params) {
    const { body, length } = this.paramsToBody(params);
    if (!this.uploadSession) {
      this.uploadSession = await this.dbx.filesUploadSessionStart({
				contents: body,
				close: false,
			});
      this.uploadSessionOffset = length;
    } else {
      this.dbx.filesUploadSessionAppend({
        contents: body,
        offset: this.uploadSessionOffset,
        session_id: this.uploadSession.session_id,
      });
      this.uploadSessionOffset += length;
    }
  }

  async process(params) {
    if (!this.isLoggedIn()) {
      return params;
    }

    if (this.mode === 'download') {
      return await this.downloadFileByName(params);
    }
    
    if (this.mode === 'upload' && this.uploadActive) {
      if (this.uploadBehavior === 'async') {
        await this.processAsyncUpload(this.uploadFilename, params);
      } else {
        await this.processSyncUpload(this.uploadFilename, params);
      }
    }
  
    return params;
  }
}
