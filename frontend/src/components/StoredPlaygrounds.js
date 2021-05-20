import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Card,
  Image,
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class StoredPlaygrounds extends Component {
  renderCard = item => {
    const { url } = this.props;
    return (
      <Card 
        style={s(t.p10)}
        key={`board-card-${item.key}`}
      >
        <Link
          key={`board-card-link-${item.key}`}
          to={url(item.key)}
        > 
          <Card.Content>
            <Image
              floated="right"
              size="mini"
              src={item.image || '/assets/logo.png'}
              style={{ marginTop: 3 }}
            />
            <Card.Header style={{ marginTop: 3, textAlign: 'left', color: '#4183c4' }}>
              <h1 style={t.fs15}>{item.key}</h1>
            </Card.Header>
            <Card.Meta style={{ margin: '5px 0px', textAlign: 'left' }}>
              {item.key}
            </Card.Meta>
            <Card.Description style={{ marginTop: 10, color: 'rgb(84 84 84)' }}>
              <div style={t.tl}>
                { item.key }
              </div>
            </Card.Description>
          </Card.Content>
        </Link>
      </Card>
    );
  }

  renderBoards = savedBoard => {
    const { style={} } = this.props;
    return (
      <div style={s(t.mt10, t.mb10)}>
        <Card.Group 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            width: '90%',
            height: 120, 
            overflowY: 'auto',
            margin: 'auto',
            border: 'solid 1px #ccc',
            borderRadius: 3,
            padding: 10,
            ...style
          }}
        >
          { savedBoard.map(this.renderCard) }
        </Card.Group>
      </div>
    );
  }

  render() {
    const { savedBoards } = this.props;
    return savedBoards.length > 0 && this.renderBoards(savedBoards);
  }
}