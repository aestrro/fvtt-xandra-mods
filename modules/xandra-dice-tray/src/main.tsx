import { bootstrap, registerSettings } from './foundry';
import './styles/dice-tray.css';

Hooks.once('init', registerSettings);
Hooks.once('ready', bootstrap);
