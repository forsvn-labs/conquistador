import { defineSandbox } from 'eve/sandbox';
import { justbash } from 'eve/sandbox/just-bash';
// Pure-JS workspace for canonical skill assets. No shell/file/network tool is exposed.
export default defineSandbox({ backend: justbash({ autoInstall: false }) });
