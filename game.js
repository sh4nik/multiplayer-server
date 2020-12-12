const config = {
    type: Phaser.HEADLESS,
    autoFocus: false,
    width: 400,
    height: 250,
    physics: {
    default: 'arcade',
        arcade: {
            debug: false,
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    scale: {
        zoom: 2,
    },
};

const players = {};
const socketPool = {};
const speed = 200;

const createPlayerGameObject = (player, scene, wallsLayer) => {
    const playerSprite = scene.physics.add.sprite(player.posX, player.posY, 'player', 'walk-down-3.png');
    playerSprite.playerId = player.playerId;
    playerSprite.setSize(playerSprite.width * 0.5, playerSprite.height * 0.8);
    scene.physics.add.collider(playerSprite, wallsLayer);
    return playerSprite;
}

function preload() {
    this.load.image('tiles', 'public/tiles/dungeon.png');
    this.load.tilemapTiledJSON('dungeon', 'public/tiles/dungeon-01.json');
    this.load.atlas('player', 'public/character/fauna.png', 'public/character/fauna.json');
}

function create() {
    this.playerGameObjects = this.physics.add.group();

    const map = this.make.tilemap({ key: 'dungeon' });
    const tileset = map.addTilesetImage('dungeon', 'tiles');
    const wallsLayer = map.createStaticLayer('Walls', tileset);

    wallsLayer.setCollisionByProperty({ collides: true });

    io.on('connection', (socket) => {
        socketPool[socket.id] = socket;
        players[socket.id] = {
            playerId: socket.id,
            posX: 200,
            posY: 200,
            anim: 'hero-idle-side',
            scaleX: 1,
            offsetX: 0,
            cursors: {
                up: { isDown: false },
                right: { isDown: false },
                down: { isDown: false },
                left: { isDown: false },
            },
        };
        console.log(`Current connections [${Object.keys(socketPool).length}]`);

        const playerGameObject = createPlayerGameObject(players[socket.id], this, wallsLayer);
        this.playerGameObjects.add(playerGameObject);
    
        socket.emit('currentPlayers', players);
        socket.broadcast.emit('newPlayer', players[socket.id]);
    
        socket.on('input', (data) => {
            players[socket.id].cursors[data.key].isDown = data.isDown
        });
    
        socket.on('disconnect', () => {
            delete socketPool[socket.id];
            delete players[socket.id];
            this.playerGameObjects.getChildren().forEach((playerObj) => {
                if (playerObj.playerId === socket.id) {
                    playerObj.destroy();
                }
            });
            socket.broadcast.emit('removePlayer', socket.id);
            console.log(`Current connections [${Object.keys(socketPool).length}]`);
        });
    });
}

function update() {
    Object.keys(players).forEach((id) => {
        const player = players[id];
        this.playerGameObjects.getChildren().forEach((playerObj) => {
            if (playerObj.playerId === id) {
                if (player.cursors.left.isDown) {
                    playerObj.setVelocity(-speed, 0);
                    player.anim = 'hero-run-side';
                    player.scaleX = -1;
                    player.offsetX = 24;
                } else if (player.cursors.right.isDown) {
                    playerObj.setVelocity(speed, 0);
                    player.anim = 'hero-run-side';
                    player.scaleX = 1;
                    player.offsetX = 8;
                } else if (player.cursors.up.isDown) {
                    playerObj.setVelocity(0, -speed);
                    player.anim = 'hero-run-up';
                } else if (player.cursors.down.isDown) {
                    playerObj.setVelocity(0, speed);
                    player.anim = 'hero-run-down';
                } else {
                    playerObj.setVelocity(0, 0);
                    if (player.anim && player.anim.length) {
                        const segments = player.anim.split('-');
                        segments[1] = 'idle';
                        player.anim = segments.join('-');
                    } else {
                        player.anim = 'hero-idle-up';
                    }
                }
                player.posX = playerObj.x;
                player.posY = playerObj.y;
            }
        });
    });

    io.emit('updatePlayers', players);
}

const game = new Phaser.Game(config);

window.gameLoaded();
