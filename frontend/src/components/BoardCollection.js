import React, { Component } from 'react';
import { Link } from 'react-router-dom';
import { 
  Card,
  Image,
  Icon,
} from 'semantic-ui-react';

import { s, t } from '../styles';

export default class BoardCollection extends Component {
  renderCard = item => {
    const {
      url,
      name,
      description,
      metadata,
      image,
      repo
    } = item;
    return (
      <Card
        style={s(t.p10)}
        key={`board-card-${name}`}
      >
        <Card.Content>
          {
            !repo ? (
              <Image
                floated="right"
                size="mini"
                src={image || '/assets/shutterstock_1196210650.png'}
                style={{ marginTop: 3 }}
              />
            ) : (
              <Image 
                floated="right"
                size="mini"
                style={{ marginTop: 3 }}
              >
                <a href={repo} target="_blank" rel="noreferrer">
                  <Icon size="large" name="github" />
                </a>
              </Image>
            )
          }
          <Link
            key={`board-card-link-${name}`}
            to={url}
          > 
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
          </Link>
        </Card.Content>
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