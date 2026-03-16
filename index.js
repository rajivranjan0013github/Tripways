/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import ShareMenuScreen from './src/screens/ShareMenuScreen';

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('ShareMenu', () => ShareMenuScreen);
