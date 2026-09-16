/**
 * Application entry point - preloads runtime assets, then renders <App/>.
 */
import { render } from 'preact';
import { App } from '@/app/app';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

render(<App />, root);
