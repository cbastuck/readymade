import React, { Component } from 'react'
// import { Link } from 'react-router-dom';

import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';

import './About.css';

//import cb from './cb.png'
//import jcb from './jcb.png'
//import sn from './sn.png'

class Profile extends Component {
  render() {
    return (
      <div>
        <h3>{this.props.name}</h3>
        <img 
          alt="none"
          src={this.props.avatar} 
          width="150"
          height="150"
        />
        <p>
          {this.props.title}
        </p>
        <div>
          {this.props.description}
        </div>
      </div>
    );
  }
}

export default class About extends Component {

  renderProfile(nick, image, description) {
    return (
       <div className="column">
        <Profile 
          avatar={image}
          name={nick}
          title=""
          description={description}
        />
      </div>
    );
  }

  render() {
    return (
      <div>
        <Toolbar />
        <div className="about-image container">
          <div className="about-text">
            <h1>About</h1>
            <div>
              Everybody! Be able to orchestrate Technology.
            </div>
            <div className="ui relaxed grid">
              <div className="three column row">
                { 
                  [
                    //this.renderProfile('cbx', cb),
                    //this.renderProfile('jcb', jcb),
                    //this.renderProfile('snk', sn),
                  ]
                }
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
}