import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Card,
  Image,
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class BoardCollection extends Component {
  renderCard = item => {
    const {
      url,
      name,
      description,
      metadata,
      image='/assets/shutterstock_1196210650.png',
    } = item;
    return (
      <Card
        style={s(t.p10)}
        key={`board-card-${name}`}
      >
        <Link
          key={`board-card-link-${name}`}
          to={url}
        > 
          <Card.Content>
            {
              image && (
                <Image
                  floated="right"
                  size="mini"
                  src={image}
                  style={{ marginTop: 3 }}
                />
              )
            }
            <Card.Header style={{ marginTop: 3, textAlign: 'left', color: '#4183c4' }}>
              <h1 style={t.fs15}>{name}</h1>
            </Card.Header>
            {
              metadata && (
                <Card.Meta style={{ margin: '5px 0px', textAlign: 'left' }}>
                  {metadata}
                </Card.Meta>
              )
            }
            {
               description && (
                <Card.Description style={{ marginTop: 10, color: 'rgb(84 84 84)' }}>
                  <div style={t.tl}>
                    { description }
                  </div>
                </Card.Description>
              )
            }
          </Card.Content>
        </Link>
      </Card>
    );
  }

  renderBoards = items => {
    const { 
      height=120,
      style={} 
    } = this.props;
    return (
      <div>
        <Card.Group 
          itemsPerRow={4}
          style={{
            height, 
            overflowY: 'auto',
            margin: 'auto',
            border: 'solid 1px #ccc',
            borderRadius: 3,
            padding: 10,
            ...style
          }}
        >
          { items.map(this.renderCard) }
        </Card.Group>
      </div>
    );
  }

  render() {
    const { items } = this.props;
    return items.length > 0 && this.renderBoards(items);
  }
}