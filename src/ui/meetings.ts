// What the people in the building actually say. Every weekly situation is played as a
// meeting, a call or a confrontation; this table gives the cards that were written as a
// prompt and some buttons their voices: who's across from you, where, what they open with,
// and for each choice (in order) what you say and how they take it. Cards that carry their
// own dialogue keep it. The effects of each choice are unchanged.
import type { ActionCard } from './actions';

interface Script { speaker?: string; where?: string; post?: ActionCard['post']; lines: string[]; replies?: ([string, string] | null)[] | Record<string, [string, string]> }
type Writer = (c: ActionCard) => Script | null;

const ln = (c: ActionCard) => (c.p ? c.p.ln : 'him');
const full = (c: ActionCard) => (c.p ? `${c.p.fn} ${c.p.ln}` : '');

const SCRIPTS: Record<string, Writer> = {
  holdout: c => ({ speaker: `${full(c)}'s agent`, where: 'Phone call · Monday night', lines: [`He's not coming in until there's a new deal. That's not a threat, it's where we are.`, `Every week this goes, the number goes up. You know that.`],
    replies: { 'Negotiate': [`Let's get in a room and finish this.`, `Now we're talking. I'll be there tomorrow.`], 'Fine Him': [`Then the fines start. He's under contract.`, `Fine him. It'll make a great headline for us.`], 'Trade Block': [`Then we'll see what the league thinks he's worth.`, `Shop him if you want. Nobody's giving you what he's worth.`], 'Wait Him Out': [`We can wait.`, `So can we. He's got money saved. Do you have a replacement saved?`] } }),
  extend: c => ({ speaker: full(c), where: 'Your office · after practice', lines: [`Coach, I'm not trying to make it a thing. I just want to know where I stand.`, `I want to finish my career here. I need to know you want that too.`],
    replies: [[`We want you here. Have your agent call me.`, `That's what I needed to hear.`], [`Let's play the season out and handle it in the spring.`, `...Okay. I hear you.`]] }),
  depth: c => ({ speaker: full(c), where: 'Your office · Wednesday', lines: [`I'm not going to be the guy who complains. But I've outplayed him in practice for three weeks.`, `Put the tape on. Tell me I'm wrong.`],
    replies: [[`You've earned it. You're starting Sunday.`, `I won't let you down.`], [`Let's look at the depth chart together.`, `That's all I'm asking.`], [`You're not wrong. But he's the starter.`, `Then I'll keep making it hard on you.`]] }),
  inj: c => ({ speaker: 'Head athletic trainer', where: 'Training room · Monday morning', lines: [`The MRI came back. ${ln(c)} is going to miss real time.`, `We need a plan for who takes his reps this week.`],
    replies: [[`Let's look at the depth chart.`, `I'll send you his full report.`], [`See who's on the street.`, `Pro scouting already has a list.`]] }),
  trade: c => ({ speaker: `${c.team.name} front office`, where: 'Phone call · Tuesday', lines: [`I'll get right to it. We've got an offer we think works for both sides.`, `I can hold it until the end of the week.`],
    replies: [[`Send it over. I'll look at it today.`, `It's in your inbox.`], [`We're not interested.`, `Understood. The offer was there.`]] }),
  deadline: c => ({ speaker: 'Your GM', where: 'War room · deadline week', lines: [`Phones are going to ring all week. We have to decide who we are this year.`, `Buy, sell or stand pat. I need a direction.`],
    replies: [[`Let's go shopping.`, `I'll have the board up in an hour.`], [`Put some names out there.`, `I'll see what the market says.`], [`We're staying the course.`, `Fine by me. I like this group.`]] }),
  owner: c => ({ speaker: 'Team owner', where: `Owner's suite · Thursday`, lines: [`I don't get involved in football decisions. You know that.`, `But I have a stadium to fill and I'd like to know what Sunday looks like.`],
    replies: [[`We're going to win this game.`, `I'm going to hold you to that.`], [`I need you to be patient with this group.`, `Patience is expensive. But all right.`], [`Let me walk you through the plan.`, `Now that I like. Show me.`]] }),
  locker: c => ({ speaker: 'Team captain', where: 'Locker room · after the walkthrough', lines: [`Coach, guys are starting to point fingers. Offense, defense, it's getting loud.`, `We need to fix it before it gets out of the building.`],
    replies: [[`Players only. You fix it.`, `We'll get it done tonight.`], [`Dinner, my place. Everybody.`, `Guys will appreciate that.`], [`Anybody pointing fingers can do it from the bench.`, `Message received. Not everybody'll like it.`]] }),
  rival: c => ({ speaker: 'Your defensive coordinator', where: 'Staff room · Monday', lines: [`It's ${c.team.nick} week. You know what this building is like this week.`, `How do you want to set the tone with the guys?`],
    replies: [[`Let them feel it. This one matters.`, `They'll be ready to run through a wall.`], [`It counts the same as every other game.`, `Smart. Keep the emotions out of it.`]] }),
  bb: c => ({ speaker: 'Your PR director', where: 'Phone call · Wednesday', lines: [`Your quote is on their bulletin board. And their locker room. And ESPN.`, `Do you want to say anything else about it?`],
    replies: [[`I stand by every word.`, `Okay. I'll let the network know you're doubling down.`], [`I'll clarify it. I respect them.`, `That'll calm it down.`]] }),
  guar: c => ({ speaker: 'Your PR director', where: 'Phone call · Tuesday', lines: [`The guarantee is everywhere. People want to know if you meant it.`],
    replies: [[`I meant it. The guys will back it up.`, `Bold. I hope they do.`], [`It came out wrong. Let me fix it.`, `I'll set up a statement.`]] }),
  diva: c => ({ speaker: full(c), where: 'Your office · Thursday', lines: [`Three catches last week. Three. I'm open all day and the ball goes everywhere else.`, `I can't help this team standing on the sideline in my head.`],
    replies: [[`You're getting fed this week.`, `That's what I'm talking about.`], [`Sit down. Let's talk about it, just us.`, `...Fine. I'm listening.`], [`The ball goes where the defense tells it to.`, `Okay. We'll see.`]] }),
  mentor: c => ({ speaker: 'Position coach', where: 'Position room · Tuesday', lines: [`The vet has been staying late with ${ln(c)}. Unofficially.`, `If we made it official, the kid would grow faster.`],
    replies: [[`Make it official.`, `I'll set up their schedule.`], [`Not this year.`, `Understood.`]] }),
  vet: c => ({ speaker: full(c), where: 'Training room · Wednesday', lines: [`I'm fine. I'm sore, I'm old, I'm fine.`, `Don't sit me, Coach.`],
    replies: [[`Light week. You'll thank me in December.`, `...Yeah. All right.`], [`You play through it.`, `That's what I wanted to hear.`]] }),
  poach: c => ({ speaker: 'Your coordinator', where: 'Your office · Monday', lines: [`I got a call about an interview. I wanted you to hear it from me first.`],
    replies: [[`You're under contract. We need you here.`, `I understand. I'm all in.`], [`Let's make sure you want to stay.`, `I appreciate that. Truly.`], [`Go take the interview. You've earned it.`, `Thank you. I won't forget it.`]] }),
  poachps: c => ({ speaker: 'Your GM', where: 'Phone call · Tuesday', lines: [`${c.team.name} want ${full(c)} off our practice squad. They'll sign him to their 53.`, `Promote him now or we lose him.`],
    replies: [[`Promote him.`, `Done. He'll be thrilled.`], [`Let him go. Good for him.`, `I'll let him know.`]] }),
  standout: c => ({ speaker: 'Position coach', where: 'Practice field · Thursday', lines: [`${full(c)} has been the best player on the scout team for a month.`, `He's earned some real reps.`],
    replies: [[`Give him extra work.`, `He's going to love that.`], [`Stay the course for now.`, `Okay. He'll keep pushing.`]] }),
  clash: c => ({ where: 'Locker room · Monday', lines: [`The fight is all over the highlight shows. The room is waiting to see what you do.`],
    replies: [[`He sits a game. Nobody embarrasses this team.`, `The room goes quiet. Message received.`], [`Everybody in the meeting room. Now.`, `It gets loud. It clears the air.`], [`They're grown men. They'll settle it.`, `They do. Mostly.`]] }),
  curfew: c => ({ speaker: full(c), where: 'Your office · 7:15 AM', lines: [`Coach, I know. I was out late, I lost track of time. It won't happen again.`],
    replies: [[`You sit Sunday.`, `...Yes sir.`], [`It's going to cost you.`, `I deserve that.`], [`I didn't hear about it.`, `Thank you, Coach.`]] }),
  analytics: c => ({ speaker: 'Analytics director', where: 'Your office · Tuesday', lines: [`We left eleven expected points on the field this year on fourth downs.`, `The numbers say go more. A lot more.`],
    replies: [[`Show me the chart. We'll go.`, `You won't regret it.`], [`I trust my gut on fourth down.`, `Understood. I'll keep the chart on the sideline anyway.`]] }),
  revenge: c => ({ speaker: full(c), where: 'Practice field · Thursday', lines: [`I'm not going to pretend this one doesn't mean something.`, `They let me go. I want to make them feel it.`],
    replies: [[`Then let's put the ball in your hands.`, `That's all I need.`], [`It's one game. Play your game.`, `Yeah. Business.`]] }),
  pom: c => ({ speaker: full(c), where: 'Locker room · Monday', lines: [`Coach, the guys want a players-only meeting tonight.`, `No coaches. No staff. Just us.`],
    replies: [[`It's your room. Take it.`, `Thank you. We'll handle it.`], [`The coaches stay.`, `...All right.`]] }),
  rumor: c => ({ speaker: full(c), where: 'Hallway outside your office', lines: [`My agent just called. There's a report you're shopping me.`, `Is it true?`],
    replies: [[`It's not true. Ignore it.`, `Okay. Okay, good.`], [`I don't talk about rumors.`, `That's not a no.`], [`We're listening to offers.`, `Wow. Okay. Thanks for being straight.`]] }),
  trick: c => ({ speaker: 'Your offensive coordinator', where: 'Film room · late Tuesday', lines: [`I found something on their tape. Their backside end crashes on every jet motion.`, `Give me ten minutes of practice and we hit a throwback for six.`],
    replies: [[`Install it.`, `You won't regret it.`], [`We stick to the base offense.`, `Your call. I'll keep it in the pocket.`]] }),
  capt: c => ({ speaker: 'Leadership council', where: 'Team meeting room', lines: [`We need a new captain. Two names keep coming up. The room wants to know where you stand.`] }),
  mtg: c => ({ where: 'Team meeting room · Monday 8 AM', lines: [`Two straight losses. Every player is in the room, and they're all looking at you.`] }),
  wrroom: c => ({ speaker: full(c), where: 'Receivers meeting', lines: [`I'm just saying it out loud: I'm open. Watch the tape.`, `I'm not asking for 15 targets. I'm asking to be part of the plan.`],
    replies: [[`You'll get your looks this week.`, `That's all I wanted.`], [`The plan is the plan.`, `...Okay.`]] }),
  qbroom: c => ({ speaker: full(c), where: 'Quarterbacks room', lines: [`I want reps against the ones. Scout team doesn't get me ready if something happens.`],
    replies: [[`You'll get some.`, `Thank you. I'll be ready.`], [`The starter gets the work.`, `Understood.`]] }),
  dcmtg: c => ({ speaker: 'Your defensive coordinator', where: 'Staff room · Tuesday', lines: [`What we did last week won't work against these guys. I want a new plan.`, `It's a lot to install in a short week.`],
    replies: [[`Install it.`, `We'll be up late. It'll be worth it.`], [`Keep it simple.`, `Simple it is.`]] }),
  pod: c => ({ post: c.p ? { handle: `@${c.p.fn.toLowerCase()}${c.p.ln.toLowerCase()}pod`, name: `The ${c.p.ln} Show`, text: `New episode 🎙️ Real talk: the team we play Sunday is overrated and everybody's scared to say it. Link in bio.` } : undefined, speaker: 'Your PR director', where: 'Trending · this morning', lines: [`${full(c)} called them overrated on his podcast. It's their whole pregame show now.`],
    replies: [[`Fine him.`, `I'll let him know.`], [`Let him talk.`, `Okay. Buckle up.`]] }),
  post: c => ({ post: c.p ? { handle: `@${c.p.fn.toLowerCase()}${c.p.ln.toLowerCase()}${(c.p.num ?? 0) || ''}`, name: `${c.p.fn} ${c.p.ln}`, text: `Funny how the people upstairs always know best. I'll keep my head down and do my job I guess 🤷🏾‍♂️` } : undefined, speaker: 'Your PR director', where: 'Trending · this morning', lines: [`${full(c)}'s post is going around. It's not great.`, `How do you want to handle it?`],
    replies: [[`Fine him.`, `I'll send the letter.`], [`I've got his back publicly.`, `That'll play well with the players.`], [`I'll handle it in my office.`, `Good. Keep it quiet.`]] }),
  scout: c => ({ speaker: 'Director of college scouting', where: 'Phone call · Thursday', lines: [`I've got two trips I can make this weekend. Where do you want eyes?`] }),
  short: c => ({ speaker: 'Your coordinators', where: 'Staff room · Monday night', lines: [`Thursday game. We have two real practices, maybe.`, `Do we keep it light or put in a real plan?`],
    replies: [[`Walkthroughs only. Fresh legs.`, `The trainers will love you.`], [`Full game plan.`, `Long nights. We'll get it in.`]] }),
  bye: c => ({ speaker: 'Your staff', where: 'Staff room · bye week', lines: [`Bye week. How do you want to use it?`] }),
  film: c => ({ speaker: 'Quality-control coach', where: 'Film room · 2 AM', lines: c.choices.length === 2 ? [`You have to see this. Their nickel corner creeps a half-step before every pressure.`] : [`I've been through all their tape. They've got a tell, and they've got a weakness.`, `Where do you want to put the emphasis this week?`] }),
  tough: c => ({ speaker: full(c), where: 'Training room · Thursday', lines: [`I can go, Coach. It's sore, that's all. I've played on worse.`, `Don't make me watch this one from the sideline.`],
    replies: [[`If the trainers sign off, you're in.`, `That's all I ask. I'll be ready.`], [`Not this week. I need you in December.`, `...Yes sir. I hate it, but okay.`]] }),
  rook: c => ({ speaker: 'Position coach', where: 'Practice field · Wednesday', lines: [`${full(c)} is starting to look like he belongs. He's picking things up faster than anybody in the room.`, `I think he's ready for more.`],
    replies: [[`Pair him with a veteran and keep building.`, `Good. That's how you make a pro.`], [`He starts Sunday.`, `He's going to be juiced. So am I.`], [`Not yet. Let him earn it.`, `Fair. He'll keep pushing.`]] }),
  natl: c => ({ speaker: 'National reporter', where: 'Sideline interview · live', lines: [`Coach, quick one before you go. People are asking about the head coach's job security. Where do you stand?`],
    replies: { 'Full Vote of Confidence': [`He's our coach. Period.`, `Strong words. We'll see how they hold up.`], 'Everyone Is Evaluated': [`Everybody in this building is evaluated every week. Me too.`, `So that's not a yes.`], 'Decline the Question': [`I'm not doing this today.`, `Noted.`], 'Promise the Playoffs': [`We're making the playoffs. Write it down.`, `I will.`], 'Talk About the Process': [`We trust the process we've built.`, `The fans want results, not process.`] } }),
  starint: c => ({ speaker: 'Network host', where: 'Sit-down interview · studio', lines: [`${full(c)} was asked about his future on our show and didn't commit. Is this his last year in ${c.team.name.split(' ').slice(0, -1).join(' ')}?`] }),
  signs: c => ({ speaker: 'League office', where: 'Phone call · Wednesday', lines: [`We've received a complaint from the ${c.team.name} about your staff's sideline conduct.`, `We'd like your response on the record.`] }),
};

/** Fill in the meeting for a card that doesn't carry its own. */
export function withMeeting(c: ActionCard): ActionCard {
  if (c.lines?.length || c.matchup) return c;
  const key = c.id.split('-')[0];
  const s = SCRIPTS[key]?.(c);
  if (!s) return c;
  const rep = (x: ActionCard['choices'][number], i: number) => (Array.isArray(s.replies) ? s.replies[i] : s.replies?.[x.label]) ?? null;
  return {
    ...c, speaker: c.speaker ?? s.speaker, where: c.where ?? s.where, lines: s.lines, narr: !s.speaker, post: c.post ?? s.post,
    choices: c.choices.map((x, i) => { const r = rep(x, i); return r && !x.reply ? { ...x, reply: r[0], react: x.react ?? r[1] } : x; }),
  };
}
