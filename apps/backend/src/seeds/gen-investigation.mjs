// Generates 20 hand-templated investigation cases → writes data/investigation-cases.json.
// Each case: a premise, 3–4 suspects, 2–3 evidence items, a timeline, and a fixed guilty suspect.
// Deterministic (no randomness) so the set is stable. Run: node src/seeds/gen-investigation.mjs

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

const CASES = [
  {
    title: 'The Missing Trophy', brief: 'The community trophy vanished from the locked hall overnight. Three people held keys.',
    suspects: [['Caretaker', 'Holds the master key; claims he was home all night.'], ['Captain', 'Wanted the trophy relocated; alibi is a phone call.'], ['Treasurer', 'Last to leave; signed out at 9pm.']],
    evidence: [['Door log', 'Keycard entry at 11:42pm under the caretaker’s card.'], ['Phone records', 'The captain’s call ended at 10:30pm, not midnight.']],
    timeline: ['9:00pm treasurer signs out', '10:30pm captain’s call ends', '11:42pm keycard entry'], guilty: 0,
  },
  {
    title: 'The Spoiled Soup', brief: 'The wedding soup was ruined with too much salt minutes before serving.',
    suspects: [['Head Cook', 'Tasted it last and approved it.'], ['Rival Caterer', 'Lost the contract to the couple.'], ['New Helper', 'Was alone with the pot during the toast.']],
    evidence: [['Salt sack', 'A half-empty sack found behind the rival caterer’s van.'], ['CCTV', 'Shows the rival entering the kitchen at 2pm.']],
    timeline: ['1:30pm cook approves the soup', '2:00pm rival enters kitchen', '2:15pm soup served and rejected'], guilty: 1,
  },
  {
    title: 'The Vanished Painting', brief: 'A valuable painting disappeared from the gallery during a power cut.',
    suspects: [['Night Guard', 'Reported the outage; was on duty alone.'], ['Curator', 'Had insured the painting heavily last week.'], ['Electrician', 'Serviced the fuse box that morning.']],
    evidence: [['Insurance form', 'Curator doubled the coverage six days prior.'], ['Fuse box', 'Tampered manually, not a fault, per the inspector.']],
    timeline: ['Morning: electrician services fuse box', '8pm power cut', '8:05pm painting gone'], guilty: 1,
  },
  {
    title: 'The Broken Window', brief: 'A shop window was smashed and the till emptied after closing.',
    suspects: [['Ex-Employee', 'Fired last month; still had a uniform.'], ['Neighbour', 'Complained about noise for weeks.'], ['Delivery Driver', 'Made a late drop-off that evening.']],
    evidence: [['Footprints', 'Match work boots issued to staff.'], ['Receipt', 'Driver’s drop logged at 6pm, store shut at 7pm.']],
    timeline: ['6:00pm delivery', '7:00pm store closes', '7:40pm alarm triggers'], guilty: 0,
  },
  {
    title: 'The Tampered Scoreboard', brief: 'The quiz final scoreboard was altered to crown the wrong winner.',
    suspects: [['Scorekeeper', 'Had sole access to the laptop.'], ['Runner-up', 'Argued about a ruling earlier.'], ['Sponsor', 'Wanted a local team to win.']],
    evidence: [['Login log', 'One login at 9:50pm — the scorekeeper’s.'], ['Edit history', 'A score changed at 9:52pm.']],
    timeline: ['9:45pm quiz ends', '9:50pm scorekeeper login', '9:52pm score edited'], guilty: 0,
  },
  {
    title: 'The Empty Fuel Tank', brief: 'The generator ran dry overnight though it was filled at dusk.',
    suspects: [['Watchman', 'Filled it and kept the key.'], ['Tenant', 'Complained about the fuel cost.'], ['Mechanic', 'Serviced the generator that day.']],
    evidence: [['Siphon hose', 'Found hidden near the tenant’s unit.'], ['Fuel log', 'Tank was full at 7pm per the watchman.']],
    timeline: ['7:00pm tank filled', 'Midnight generator stops', 'Hose found at dawn'], guilty: 1,
  },
  {
    title: 'The Switched Cake', brief: 'The birthday cake was swapped for a cheaper one before the cut.',
    suspects: [['Baker', 'Delivered both cakes that day.'], ['Cousin', 'Was upset about the budget.'], ['Planner', 'Handled the dessert table alone.']],
    evidence: [['Delivery note', 'Only one premium cake was paid for.'], ['Table photo', 'Planner rearranged the table at 4pm.']],
    timeline: ['2pm cakes delivered', '4pm planner at the table', '5pm cake cut'], guilty: 2,
  },
  {
    title: 'The Leaked Question', brief: 'An exam question leaked to one class the night before.',
    suspects: [['Printer', 'Printed the papers after hours.'], ['Teacher', 'Has a relative in the class.'], ['Clerk', 'Filed the master copy.']],
    evidence: [['Phone forward', 'A photo sent from the teacher’s number at 9pm.'], ['Print log', 'Printing finished at 6pm, before the leak.']],
    timeline: ['6pm printing done', '9pm photo forwarded', 'Next morning exam'], guilty: 1,
  },
  {
    title: 'The Missing Donations', brief: 'Cash donations from the fundraiser came up short by half.',
    suspects: [['Treasurer', 'Counted the cash alone.'], ['Volunteer', 'Held the box during the event.'], ['Auditor', 'Reviewed the totals afterward.']],
    evidence: [['Count sheet', 'Treasurer’s figure differs from the ticket count.'], ['Box seal', 'Reopened and resealed, per the auditor.']],
    timeline: ['Event ends', 'Treasurer counts alone', 'Auditor flags mismatch'], guilty: 0,
  },
  {
    title: 'The Sabotaged Drone', brief: 'A racing drone crashed mid-final after a tampered battery.',
    suspects: [['Pilot', 'Owns the drone and the spare battery.'], ['Rival Pilot', 'Was seen near the pit before the race.'], ['Judge', 'Inspected the drone last.']],
    evidence: [['Battery cap', 'Loosened by hand, not flight damage.'], ['Pit camera', 'Rival lingered at the bench at 3pm.']],
    timeline: ['3pm rival at the pit', '3:30pm inspection', '4pm crash'], guilty: 1,
  },
  {
    title: 'The Phantom Order', brief: 'A huge fake catering order nearly bankrupted a small kitchen.',
    suspects: [['Manager', 'Took the order by phone.'], ['Competitor', 'Opened a rival kitchen nearby.'], ['Supplier', 'Was paid up front for ingredients.']],
    evidence: [['Caller ID', 'Traced to a burner near the competitor’s shop.'], ['Deposit', 'Supplier received and kept the deposit.']],
    timeline: ['Call placed', 'Ingredients bought', 'Order never collected'], guilty: 1,
  },
  {
    title: 'The Altered Will', brief: 'A family will was changed days before it was read.',
    suspects: [['Lawyer', 'Drafted and stored the will.'], ['Heir', 'Visited the office that week.'], ['Witness', 'Signed both versions.']],
    evidence: [['Ink test', 'A clause added in newer ink.'], ['Visitor log', 'Heir signed in the day before the change.']],
    timeline: ['Heir visits', 'Clause added', 'Will read'], guilty: 1,
  },
  {
    title: 'The Cut Power Line', brief: 'A street lost power right as the night market opened.',
    suspects: [['Vendor', 'Argued over a stall location.'], ['Linesman', 'Was working the pole that afternoon.'], ['Shopowner', 'Wanted the market shut down.']],
    evidence: [['Cut marks', 'Clean cut from a tool, not weather.'], ['Toolbox', 'A bolt cutter found in the shopowner’s store.']],
    timeline: ['Afternoon line work', 'Market opens', 'Power cut'], guilty: 2,
  },
  {
    title: 'The Stolen Recipe', brief: 'A secret stew recipe appeared on a rival’s menu overnight.',
    suspects: [['Sous Chef', 'Knows the recipe by heart.'], ['Waiter', 'Serves both restaurants part-time.'], ['Critic', 'Reviewed the dish last week.']],
    evidence: [['Note photo', 'A snap of the recipe card on the waiter’s phone.'], ['Shift log', 'Waiter worked the rival’s kitchen that night.']],
    timeline: ['Recipe photographed', 'Waiter’s rival shift', 'Menu appears'], guilty: 1,
  },
  {
    title: 'The False Alarm', brief: 'A fire alarm emptied the office right before a big presentation.',
    suspects: [['Intern', 'Stood near the alarm panel.'], ['Presenter', 'Was unprepared and nervous.'], ['Rival', 'Wanted the slot rescheduled.']],
    evidence: [['Panel print', 'Manual pull at booth three.'], ['Seat map', 'Rival sat beside booth three.']],
    timeline: ['Presentation due', 'Alarm pulled', 'Office cleared'], guilty: 2,
  },
  {
    title: 'The Swapped Keys', brief: 'A car went missing after keys were swapped at a valet stand.',
    suspects: [['Valet', 'Parked all the cars.'], ['Guest', 'Lost their ticket earlier.'], ['Owner', 'Reported it for insurance.']],
    evidence: [['Ticket stub', 'Owner’s stub matched a different car.'], ['Claim form', 'Owner filed a claim within the hour.']],
    timeline: ['Cars parked', 'Keys swapped', 'Insurance claim filed'], guilty: 2,
  },
  {
    title: 'The Muddy Footprint', brief: 'A garden shed was raided and the prize seeds taken.',
    suspects: [['Gardener', 'Has the only spare key.'], ['Neighbour', 'Competes in the same flower show.'], ['Child', 'Plays near the shed daily.']],
    evidence: [['Footprint', 'Adult size, treaded boot near the show.'], ['Glove', 'A gardening glove dropped by the fence.']],
    timeline: ['Evening raid', 'Footprint found', 'Show next week'], guilty: 1,
  },
  {
    title: 'The Deleted Files', brief: 'Project files were wiped the night before a deadline.',
    suspects: [['Developer', 'Had admin access.'], ['Manager', 'Was over budget on the project.'], ['Client', 'Disputed the final invoice.']],
    evidence: [['Access log', 'A delete command at 11pm from an office IP.'], ['Badge swipe', 'Manager swiped in at 10:50pm.']],
    timeline: ['10:50pm badge swipe', '11pm delete', 'Morning deadline'], guilty: 1,
  },
  {
    title: 'The Counterfeit Ticket', brief: 'Two guests arrived with the same VIP ticket number.',
    suspects: [['Printer', 'Produced the ticket batch.'], ['Reseller', 'Sold the second ticket online.'], ['Usher', 'Scanned both at the door.']],
    evidence: [['Serial scan', 'The duplicate was a photocopy, scanned second.'], ['Listing', 'Reseller posted the number for sale.']],
    timeline: ['Tickets printed', 'Number listed online', 'Both scanned'], guilty: 1,
  },
  {
    title: 'The Overflowing Tap', brief: 'An office flooded overnight from a tap left running.',
    suspects: [['Cleaner', 'Was last to leave the kitchen.'], ['Plumber', 'Fixed the tap that day.'], ['Worker', 'Filled a kettle before leaving.']],
    evidence: [['Work order', 'Plumber left the washer loose, per the report.'], ['Sign-out', 'Cleaner signed out before the worker.']],
    timeline: ['Plumber repairs tap', 'Worker fills kettle', 'Cleaner leaves'], guilty: 1,
  }
];

const toCase = (c, i) => ({
  key: `case-${String(i + 1).padStart(2, '0')}`,
  title: c.title,
  brief: c.brief,
  suspects: c.suspects.map(([name, profile], si) => ({ id: `s${si + 1}`, name, profile })),
  evidence: c.evidence.map(([label, detail], ei) => ({ id: `e${ei + 1}`, label, detail })),
  timeline: c.timeline,
  solutionSuspectId: `s${c.guilty + 1}`,
  difficulty: 1 + (i % 3),
  ratingTier: 'family',
  tags: [],
});

const out = CASES.map(toCase);
await writeFile(join(here, 'data', 'investigation-cases.json'), JSON.stringify(out, null, 2));
console.error(`wrote ${out.length} investigation cases`);
