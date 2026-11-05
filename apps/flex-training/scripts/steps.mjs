// Dev-only: every movement's guided-player steps, one line each, as plain
// text. test/steps.txt is this output; the test fails when a plan or code
// change alters any movement's steps, so the change shows up in review.
//
//   npm run steps > test/steps.txt
import { stepsText } from '../test/steps-text.mjs';

process.stdout.write(stepsText());
