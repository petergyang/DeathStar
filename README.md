# DeathStar - 3D Space Shooter

A browser-based 3D space shooter game where players pilot an X-Wing fighter to attack the infamous Death Star.

## Project Overview

This game is built using Three.js for 3D rendering and JavaScript/HTML5 for game logic and user interface. Players control an X-Wing fighter, navigating through space to attack the Death Star while avoiding obstacles and enemy fire.

## Features (Planned)

- **3D Environment**: Space setting with stars, planets, and the Death Star
- **Player Controls**: Fly the X-Wing with keyboard/mouse controls
- **Combat System**: Shoot lasers at the Death Star and enemy fighters
- **Enemy AI**: TIE fighters that pursue and attack the player
- **Mission Objectives**: Destroy specific targets on the Death Star
- **Sound Effects**: Authentic space battle sounds
- **Score System**: Track hits, kills, and mission completion

## Development Roadmap

### Phase 1: Basic Setup
- Set up project structure
- Implement Three.js environment
- Create basic starfield background
- Add simple X-Wing model

### Phase 2: Flight Controls
- Implement keyboard/mouse controls
- Add physics for ship movement
- Create camera system that follows the X-Wing

### Phase 3: Death Star and Environment
- Add Death Star model
- Implement collision detection
- Create space environment with stars and planets

### Phase 4: Combat System
- Add laser shooting mechanics
- Implement hit detection
- Create explosion effects

### Phase 5: TIE Fighter Combat
- **Step 1: Player Health System & Basic TIE Fighter**
  - Add X-Wing health system (100 HP) with UI health bar
  - Create simple TIE Fighter model
  - Implement TIE Fighter movement toward the player

- **Step 2: Automatic Spawning & TIE Fighter Weapons**
  - Set up timer to spawn 3 TIE Fighters every 5 seconds
  - Add TIE Fighter weapons (red lasers, firing once per second)
  - Implement hit detection for TIE Fighter lasers vs player

- **Step 3: Combat Completion & Game Over**
  - Make player lasers destroy TIE Fighters
  - Add explosion effects for destroyed TIE Fighters
  - Implement game over when player health reaches 0
  - Ensure Death Star can still be destroyed to win

### Phase 6: Game Logic
- Add mission objectives
- Implement scoring system
- Create game states (start, play, game over)

### Phase 7: Polish
- Add sound effects
- Improve visual effects
- Optimize performance
- Add UI elements

## Getting Started

Instructions for setting up and running the project will be added as development progresses.

## Technologies Used

- Three.js
- JavaScript
- HTML5/CSS3
- WebGL

## Credits

This project is inspired by the Star Wars universe but is created for educational and entertainment purposes only.

## License

[MIT License](LICENSE) 