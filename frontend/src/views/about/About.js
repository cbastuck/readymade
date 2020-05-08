import React, { Component } from 'react';
import { Link } from 'react-router-dom';

import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';
import Switcher from '../../components/Switcher';

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
    const amp = {
      fontSize: ' 1.4em',
      fontWeight: 'bold',
    };
    return (
      <div>
        <Toolbar />
        <div className="about-image container">
          <div className="about-text">
            <h1><Switcher data={['About', 'Intent']} /></h1>
            <div style={{
                marginTop: 30, 
                marginBottom: 0,
                fontSize: 20,
              }}
            >
              <p><span style={amp}>Enable</span> <span style={{ fontStyle: 'italic' }}>everybody</span> to play with technical concepts.</p>
              <p>Seed <span style={amp}>Inspiration</span> and <span style={amp}>Curiousity</span> </p>
              <p>as a source for <span style={amp}>Creativity</span></p>
              <p>that allows for <span style={amp}>Improvisation</span> with complexity.</p>
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
            <Link to="/">
              <button className="button" style={{ color: 'white' }}>
                Back to Start
              </button>
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
}