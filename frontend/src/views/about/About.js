import React, { Component } from 'react';

import Toolbar from '../../components/Toolbar';
import Footer from '../../components/Footer';
import Switcher from '../../components/Switcher';

import './About.css';

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
      fontSize: ' 22',
      fontWeight: 'bolder',
      textTransform: 'uppercase',
      letterSpacing: 2,
    };
    return (
      <div>
        <Toolbar />
        <div className="about-image container">
          <div className="about-text">
            <Switcher data={['About', 'Intent']} />
            <div style={{
                marginTop: 30, 
                marginBottom: 0,
                fontSize: 20,
              }}
            >
              <p><span style={amp}>Enable</span> <span style={{ fontStyle: 'italic' }}>everybody</span> to play with technical concepts</p>
              <p>Seed <span style={amp}>Inspiration</span> and <span style={amp}>Curiosity</span> </p>
              <p>Spawn <span style={amp}>Creativity</span></p>
              <p><span style={amp}>Improvise</span> with complexity.</p>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
}