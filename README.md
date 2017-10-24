
REGISTER NEW PLAYER:
```path: POST /api/player/

payload: {
    id: string
    password: string
}

response: {
    id: string,
    token: string,
    expires: string (Date),
    points: number
}
```

LOGOUT PLAYER
```
path: POST /api/player/logout
payload: none
```


ANSWER
```path: POST /api/game/play/answer
payload: {
    answer: string
}
```

SOCKET.IO

client should:

```
 // connect using token
 const socket = ioClient.connect(url, {
       query: 'token=' + token
     });
 
 // listen to messages
 socket.on('message', (data) => {
 
 });
```

message format:
```$xslt
{
    type: string
    body: {}
}
```

message type GAME:
```$xslt
{
    type: 'game'
    body: {
        game: {
                plays: [
                    {
                        playerId: string,
                        answer: string
                    }
                ],
                category: string,
                letter: string,
                question: string,
                ongoing: boolean,
                createdAt: string (Date),
                endsOn: string (Date)
        }
    }
}
```

message type PLAYER:
```$xslt
{
    type: 'player',
    body: {
        players: [
            {
                id: string,
                points: number
            }
        ]
    }
}

```

message type SOLUTION:
```
{
    type: 'solution',
    body: {
        game: {
            plays: [
                {
                    playerId: string,
                    answer: string
                    points: number
                }
            ],
            category: string,
            letter: string,
            question: string,
            ongoing: boolean,
            createdAt: string (Date),
            endsOn: string (Date)
        }
    }
}
```