/* eslint-disable react/button-has-type */
/* eslint-disable class-methods-use-this */
// @flow
import { remote, ipcRenderer } from 'electron';
import fs from 'fs';
import React, { Component } from 'react';
import ReactLoading from 'react-loading';
import { Redirect, Link } from 'react-router-dom';
import log from 'electron-log';
import navBar from './NavBar';
import routes from '../constants/routes';
import {
  config,
  session,
  directories,
  eventEmitter,
  savedInInstallDir
} from '../index';

// import styles from './Send.css';

type Props = {
  syncStatus: number,
  unlockedBalance: number,
  lockedBalance: number,
  transactions: Array<string>,
  handleSubmit: () => void,
  transactionInProgress: boolean
};

export default class Send extends Component<Props> {
  props: Props;

  constructor(props?: Props) {
    super(props);
    this.state = {
      syncStatus: session.getSyncStatus(),
      unlockedBalance: session.getUnlockedBalance(),
      lockedBalance: session.getLockedBalance(),
      transactions: session.getTransactions(),
      importkey: false,
      importseed: false,
      importCompleted: false,
      nodeFee: session.daemon.feeAmount,
      changePassword: false,
      loginFailed: false,
      darkMode: session.darkMode
    };
    this.handleImportFromSeed = this.handleImportFromSeed.bind(this);
    this.handleImportFromKey = this.handleImportFromKey.bind(this);
    this.handleInitialize = this.handleInitialize.bind(this);
    this.handlePasswordChange = this.handlePasswordChange.bind(this);
    this.handleLoginFailure = this.handleLoginFailure.bind(this);
  }

  componentDidMount() {
    this.interval = setInterval(() => this.refresh(), 1000);
    ipcRenderer.on('handlePasswordChange', this.handlePasswordChange);
    ipcRenderer.on('importSeed', this.handleImportFromSeed);
    ipcRenderer.on('importKey', this.handleImportFromKey);
    eventEmitter.on('initializeNewSession', this.handleInitialize);
    eventEmitter.on('loginFailed', this.handleLoginFailure);
    eventEmitter.on('openNewWallet', this.handleInitialize);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
    ipcRenderer.off('handlePasswordChange', this.handlePasswordChange);
    ipcRenderer.off('importSeed', this.handleImportFromSeed);
    ipcRenderer.off('importKey', this.handleImportFromKey);
    eventEmitter.off('initializeNewSession', this.handleInitialize);
    eventEmitter.off('loginFailed', this.handleLoginFailure);
    eventEmitter.off('openNewWallet', this.handleInitialize);
  }

  handleLoginFailure() {
    this.setState({
      loginFailed: true
    });
  }

  handleImportFromSeed(evt, route) {
    clearInterval(this.interval);
    this.setState({
      importseed: true
    });
  }

  handleImportFromKey(evt, route) {
    clearInterval(this.interval);
    this.setState({
      importkey: true
    });
  }

  handlePasswordChange() {
    this.setState({
      changePassword: true
    });
  }

  handleSubmit(event) {
    // We're preventing the default refresh of the page that occurs on form submit
    event.preventDefault();

    let [seed, height] = [
      event.target[0].value, // seed
      event.target[1].value // scan height
    ];
    if (seed === undefined) {
      return;
    }
    if (height === '') {
      height = '0';
    }
    const options = {
      defaultPath: remote.app.getPath('documents')
    };
    const savePath = remote.dialog.showSaveDialog(null, options);
    if (savePath === undefined) {
      return;
    }
    session.saveWallet(session.walletFile);
    if (savedInInstallDir(savePath)) {
      remote.dialog.showMessageBox(null, {
        type: 'error',
        buttons: ['OK'],
        title: 'Can not save to installation directory',
        message:
          'You can not save the wallet in the installation directory. The windows installer will delete all files in the directory upon upgrading the application, so it is not allowed.'
      });
      return;
    }
    const importedSuccessfully = session.handleImportFromSeed(
      seed,
      savePath,
      parseInt(height)
    );
    if (importedSuccessfully === true) {
      remote.dialog.showMessageBox(null, {
        type: 'info',
        buttons: ['OK'],
        title: 'Wallet imported successfully!',
        message:
          'The wallet was imported successfully. Go to Wallet > Password and add a password to the wallet if desired.'
      });
      const [programDirectory, logDirectory, walletDirectory] = directories;
      const modifyConfig = config;
      modifyConfig.walletFile = savePath;
      log.debug(`Set new config filepath to: ${modifyConfig.walletFile}`);
      config.walletFile = savePath;
      fs.writeFileSync(
        `${programDirectory}/config.json`,
        JSON.stringify(config, null, 4),
        err => {
          if (err) throw err;
          log.debug(err);
        }
      );
      log.debug('Wrote config file to disk.');
      eventEmitter.emit('initializeNewSession');
    } else {
      remote.dialog.showMessageBox(null, {
        type: 'error',
        buttons: ['OK'],
        title: 'Error importing wallet!',
        message: 'The wallet was not imported successfully. Try again.'
      });
    }
  }

  refresh() {
    this.setState(prevState => ({
      syncStatus: session.getSyncStatus()
    }));
  }

  handleInitialize() {
    this.setState({
      importCompleted: true
    });
  }

  render() {
    if (this.state.loginFailed === true) {
      return <Redirect to="/login" />;
    }
    if (this.state.changePassword === true) {
      return <Redirect to="/changepassword" />;
    }

    if (this.state.importkey === true) {
      return <Redirect to="/importkey" />;
    }

    if (this.state.importCompleted === true) {
      return <Redirect to="/" />;
    }

    return (
      <div>
        {this.state.darkMode === false && (
          <div className="wholescreen">
            {navBar('import', false)}
            <div className="maincontent">
              <form onSubmit={this.handleSubmit}>
                <div className="field">
                  <label className="label" htmlFor="seed">
                    Mnemonic Seed
                    <textarea
                      className="textarea is-large"
                      placeholder="Enter your seed here."
                      id="seed"
                    />
                  </label>
                </div>
                <div className="field">
                  <label className="label" htmlFor="scanheight">
                    Scan Height (Optional)
                    <div className="control">
                      <input
                        className="input is-large"
                        type="text"
                        placeholder="Block height to start scanning from. Defaults to 0."
                        id="scanheight"
                      />
                    </div>
                  </label>
                </div>
                <div className="buttons">
                  <button type="submit" className="button is-success is-large ">
                    Import
                  </button>
                  <button type="reset" className="button is-large">
                    Clear
                  </button>
                </div>
              </form>
            </div>
            <div className="footerbar has-background-light" />
          </div>
        )}
        {this.state.darkMode === true && (
          <div className="wholescreen has-background-dark">
            {navBar('import', true)}
            <div className="maincontent has-background-dark">
              <form onSubmit={this.handleSubmit}>
                <div className="field">
                  <label className="label has-text-white" htmlFor="seed">
                    Mnemonic Seed
                    <textarea
                      className="textarea is-large"
                      placeholder="Enter your seed here."
                      id="seed"
                    />
                  </label>
                </div>
                <div className="field">
                  <label className="label has-text-white" htmlFor="scanheight">
                    Scan Height (Optional)
                    <div className="control">
                      <input
                        className="input is-large"
                        type="text"
                        placeholder="Block height to start scanning from. Defaults to 0."
                        id="scanheight"
                      />
                    </div>
                  </label>
                </div>
                <div className="buttons">
                  <button type="submit" className="button is-success is-large ">
                    Import
                  </button>
                  <button type="reset" className="button is-large is-black">
                    Clear
                  </button>
                </div>
              </form>
            </div>
            <div className="footerbar has-background-black" />
          </div>
        )}
      </div>
    );
  }
}
