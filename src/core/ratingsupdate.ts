// The ratings update: hand-set overalls for notable players, like a Madden roster update. The
// data model (snap counts, production, contracts) gets most players close; this table fixes
// the ones it can't read: linemen on great units, career years, injured seasons, backups on a
// hot streak, stars it underrates. Applied in both directions at league creation.
// Keyed "Full Name|POS" exactly as the roster data spells it.
export const RATING_TARGETS: Record<string, number> = {
  // QB
  'Josh Allen|QB': 97, 'Lamar Jackson|QB': 94, 'Patrick Mahomes|QB': 95, 'Joe Burrow|QB': 93, 'Drake Maye|QB': 92, 'Matthew Stafford|QB': 90,
  'Justin Herbert|QB': 90, 'Jared Goff|QB': 89, 'Jalen Hurts|QB': 89, 'Dak Prescott|QB': 89, 'Brock Purdy|QB': 88, 'Jayden Daniels|QB': 88,
  'Jordan Love|QB': 87, 'Baker Mayfield|QB': 85, 'Sam Darnold|QB': 84, 'Bo Nix|QB': 82, 'Trevor Lawrence|QB': 82, 'C.J. Stroud|QB': 81,
  'Caleb Williams|QB': 82, 'Daniel Jones|QB': 80, 'Kyler Murray|QB': 79, 'Michael Penix|QB': 77, 'Bryce Young|QB': 76, 'Tua Tagovailoa|QB': 76,
  'Jaxson Dart|QB': 76, 'Tyler Shough|QB': 74, 'Cameron Ward|QB': 73, 'J.J. McCarthy|QB': 72, 'Malik Willis|QB': 72,
  'Fernando Mendoza|QB': 77, 'Carson Beck|QB': 72, 'Ty Simpson|QB': 72, 'Drew Allar|QB': 70, 'Cade Klubnik|QB': 70,
  // RB
  'Bijan Robinson|RB': 96, 'Jahmyr Gibbs|RB': 95, 'Jonathan Taylor|RB': 94, 'Derrick Henry|RB': 92, 'Christian McCaffrey|RB': 92, 'Devon Achane|RB': 91,
  'Saquon Barkley|RB': 90, 'James Cook|RB': 90, 'Josh Jacobs|RB': 89, 'Kyren Williams|RB': 86, 'Breece Hall|RB': 84, 'Chase Brown|RB': 84,
  'J.K. Dobbins|RB': 82, 'David Montgomery|RB': 82, 'Kenneth Walker|RB': 82, 'Travis Etienne|RB': 82, 'Jaylen Warren|RB': 82, 'James Conner|RB': 81,
  'Omarion Hampton|RB': 81, 'TreVeyon Henderson|RB': 80, 'Rico Dowdle|RB': 80, "D'Andre Swift|RB": 80, 'Tony Pollard|RB': 80,
  'Rhamondre Stevenson|RB': 79, 'Quinshon Judkins|RB': 79, 'Jeremiyah Love|RB': 77, 'Jordan Mason|RB': 76, 'Jadarian Price|RB': 72,
  // WR
  "Ja'Marr Chase|WR": 98, 'Justin Jefferson|WR': 97, 'Puka Nacua|WR': 97, 'Jaxon Smith-Njigba|WR': 96, 'Amon-Ra St. Brown|WR': 94, 'CeeDee Lamb|WR': 93,
  'Nico Collins|WR': 91, 'A.J. Brown|WR': 91, 'Malik Nabers|WR': 89, 'Drake London|WR': 89, 'Rashee Rice|WR': 89, 'George Pickens|WR': 88,
  'Garrett Wilson|WR': 88, 'Davante Adams|WR': 88, 'Terry McLaurin|WR': 87, 'Tee Higgins|WR': 87, 'Brian Thomas|WR': 86, 'Jaylen Waddle|WR': 86,
  'DeVonta Smith|WR': 86, 'Chris Olave|WR': 86, 'DK Metcalf|WR': 86, 'Zay Flowers|WR': 85, 'Ladd McConkey|WR': 85, 'Mike Evans|WR': 85,
  'Jameson Williams|WR': 85, 'Courtland Sutton|WR': 85, 'Stefon Diggs|WR': 84, 'Michael Pittman|WR': 83, 'Alec Pierce|WR': 82, 'Chris Godwin|WR': 82,
  'Tetairoa McMillan|WR': 82, 'Jakobi Meyers|WR': 82, 'D.J. Moore|WR': 81, 'Khalil Shakir|WR': 81, 'Christian Watson|WR': 80, 'Jayden Reed|WR': 80,
  'Marvin Harrison|WR': 80, 'Ricky Pearsall|WR': 80, 'Jauan Jennings|WR': 80, 'Luther Burden|WR': 79, 'Romeo Doubs|WR': 79,
  'Carnell Tate|WR': 77, 'Makai Lemon|WR': 74, 'K.C. Concepcion|WR': 74, 'Denzel Boston|WR': 73,
  // TE
  'Trey McBride|TE': 96, 'Brock Bowers|TE': 95, 'George Kittle|TE': 95, 'Tucker Kraft|TE': 89, 'Travis Kelce|TE': 88, 'Sam LaPorta|TE': 88,
  'Mark Andrews|TE': 86, 'Dallas Goedert|TE': 85, 'Jake Ferguson|TE': 85, 'Hunter Henry|TE': 83, 'Kyle Pitts|TE': 82, 'Dalton Kincaid|TE': 82,
  'T.J. Hockenson|TE': 82, 'Dalton Schultz|TE': 82, 'Juwan Johnson|TE': 80, 'Pat Freiermuth|TE': 80, 'Tyler Warren|TE': 80, 'Isaiah Likely|TE': 80,
  'Evan Engram|TE': 80, 'Colston Loveland|TE': 79, 'Darren Waller|TE': 79, 'Harold Fannin|TE': 77, 'Mike Gesicki|TE': 77, 'Brenton Strange|TE': 76, 'Kenyon Sadiq|TE': 74,
  // OT
  'Penei Sewell|OT': 97, 'Tristan Wirfs|OT': 96, 'Trent Williams|OT': 94, 'Jordan Mailata|OT': 93, 'Lane Johnson|OT': 93, 'Rashawn Slater|OT': 92,
  'Laremy Tunsil|OT': 89, 'Garett Bolles|OT': 88, 'Spencer Brown|OT': 87, 'Jake Matthews|OT': 87, 'Andrew Thomas|OT': 87, 'Bernhard Raimann|OT': 86,
  'Dion Dawkins|OT': 85, 'Charles Cross|OT': 85, 'Ronnie Stanley|OT': 85, "Brian O'Neill|OT": 85, 'Mike McGlinchey|OT': 84, 'Abraham Lucas|OT': 84,
  'Paris Johnson|OT': 83, 'Alaric Jackson|OT': 82, 'Luke Goedeke|OT': 82, 'Braden Smith|OT': 82, 'Orlando Brown|OT': 82, 'Taylor Moton|OT': 82,
  'Amarius Mims|OT': 82, 'Kolton Miller|OT': 82, 'Austin Jackson|OT': 81, 'Ikem Ekwonu|OT': 81, 'Terence Steele|OT': 80, 'Tytus Howard|OT': 79,
  'Dan Moore|OT': 78, 'Troy Fautanu|OT': 77, 'Tyler Guyton|OT': 76, 'Colton McKivitz|OT': 76, 'Anton Harrison|OT': 76, 'Roger Rosengarten|OT': 74,
  // G
  'Quenton Nelson|G': 95, 'Chris Lindstrom|G': 94, 'Joe Thuney|G': 94, 'Tyler Smith|G': 93, 'Trey Smith|G': 91, 'Landon Dickerson|G': 90,
  'Quinn Meinerz|G': 90, "O'Cyrus Torrence|G": 87, 'Kevin Dotson|G': 84, 'Alijah Vera-Tucker|G': 84, 'Robert Hunt|G': 83, 'Isaac Seumalo|G': 82,
  'David Edwards|G': 82, 'Ben Powers|G': 82, 'Cesar Ruiz|G': 82, 'Will Fries|G': 81, 'Jonah Jackson|G': 80, 'Jon Runyan|G': 80,
  'Steve Avila|G': 79, 'John Simpson|G': 79, 'Ezra Cleveland|G': 79, 'Ben Bredeson|G': 79, 'Aaron Banks|G': 79, 'Patrick Mekari|G': 78,
  'Matthew Bergeron|G': 78, 'Cody Mauch|G': 77, 'Grey Zabel|G': 77, 'Tyler Booker|G': 76, 'Sean Rhyan|G': 74, 'Matt Goncalves|G': 74,
  // C
  'Tyler Linderbaum|C': 93, 'Creed Humphrey|C': 90, 'Erik McCoy|C': 86, 'Cam Jurgens|C': 85, 'Elgton Jenkins|C': 82, 'Connor McGovern|C': 82,
  'Zach Frazier|C': 82, 'Cooper Beebe|C': 81, 'Aaron Brewer|C': 81, 'Luke Wattenberg|C': 80, 'Evan Brown|C': 80, 'Ted Karras|C': 80, 'Jake Brendel|C': 80,
  'Graham Barton|C': 79, 'Hjalte Froholdt|C': 78, 'Tyler Biadasz|C': 78, 'Josh Myers|C': 78, 'Coleman Shelton|C': 75, 'Cade Mays|C': 75, 'Tanor Bortolini|C': 74,
  // EDGE
  'Myles Garrett|EDGE': 99, 'Micah Parsons|EDGE': 98, 'Maxx Crosby|EDGE': 96, 'Aidan Hutchinson|EDGE': 95, 'T.J. Watt|EDGE': 94, 'Nick Bosa|EDGE': 93,
  'Trey Hendrickson|EDGE': 92, 'Will Anderson|EDGE': 91, 'Danielle Hunter|EDGE': 91, 'Nik Bonitto|EDGE': 89, 'Brian Burns|EDGE': 88, 'Jared Verse|EDGE': 87,
  'Josh Hines-Allen|EDGE': 87, 'Jonathan Greenard|EDGE': 87, 'Zach Allen|EDGE': 87, 'Josh Sweat|EDGE': 85, 'Gregory Rousseau|EDGE': 85, 'Chase Young|EDGE': 84,
  'Rashan Gary|EDGE': 84, 'Montez Sweat|EDGE': 84, 'George Karlaftis|EDGE': 84, 'Alex Highsmith|EDGE': 83, 'Tuli Tuipulotu|EDGE': 82, 'Demarcus Lawrence|EDGE': 82,
  'John Franklin-Myers|EDGE': 82, 'Odafe Oweh|EDGE': 81, 'Abdul Carter|EDGE': 80, 'James Pearce|EDGE': 80, 'Jadeveon Clowney|EDGE': 79, 'David Bailey|EDGE': 77,
  'Dorance Armstrong|EDGE': 76, 'Rueben Bain|EDGE': 76, 'Al-Quadin Muhammad|EDGE': 75, 'Akheem Mesidor|EDGE': 74, 'Caleb Banks|EDGE': 74,
  'Keldric Faulk|EDGE': 73, 'R Mason Thomas|EDGE': 72, 'Cashius Howell|EDGE': 72, 'Malachi Lawrence|EDGE': 72,
  // DT
  'Dexter Lawrence|DT': 95, 'Chris Jones|DT': 92, 'Jeffery Simmons|DT': 92, 'Jalen Carter|DT': 92, 'Quinnen Williams|DT': 91, 'DeForest Buckner|DT': 90,
  'Leonard Williams|DT': 88, 'Nnamdi Madubuike|DT': 88, 'Vita Vea|DT': 88, 'Osa Odighizuwa|DT': 86, 'Zach Sieler|DT': 85, 'Kobie Turner|DT': 85,
  'Maliek Collins|DT': 84, 'Gervon Dexter|DT': 84, 'Milton Williams|DT': 84, 'Devonte Wyatt|DT': 82, 'Christian Barmore|DT': 81, 'Jonathan Allen|DT': 80,
  'Braden Fiske|DT': 80, 'Calais Campbell|DT': 79, 'Arik Armstead|DT': 79, 'Walter Nolen|DT': 78, 'Tershawn Wharton|DT': 78, "Jer'Zhan Newton|DT": 77,
  'Brandon Dorlus|DT': 75, 'Michael Hall|DT': 75, 'Peter Woods|DT': 74, 'Lacale London|DT': 74, 'Malcolm Roach|DT': 74,
  // LB
  'Fred Warner|LB': 95, 'Roquan Smith|LB': 94, 'Zack Baun|LB': 91, 'Jack Campbell|LB': 90, 'Devin Lloyd|LB': 87, 'Edgerrin Cooper|LB': 85,
  'Nick Bolton|LB': 85, 'Ernest Jones|LB': 85, 'Blake Cashman|LB': 84, 'Nakobe Dean|LB': 84, 'Azeez Al-Shaair|LB': 84, 'Foyesade Oluokun|LB': 84,
  'Quay Walker|LB': 83, 'Daiyan Henley|LB': 83, 'Terrel Bernard|LB': 83, 'Devin Bush|LB': 82, 'Alex Anzalone|LB': 82, 'Carson Schwesinger|LB': 82,
  'Robert Spillane|LB': 82, 'Jamien Sherwood|LB': 82, 'Mack Wilson|LB': 80, 'Kaden Elliss|LB': 80, 'Tremaine Edmunds|LB': 80, 'Bobby Okereke|LB': 80,
  'Ivan Pace|LB': 77, 'Arvell Reese|LB': 76, 'Ventrell Miller|LB': 76, 'Eric Wilson|LB': 76, 'Sonny Styles|LB': 75, 'Demetrius Knight|LB': 75,
  'Jacob Rodriguez|LB': 74, 'Justin Strnad|LB': 74, 'Anthony Hill|LB': 72, 'Josiah Trotter|LB': 72,
  // CB
  'Patrick Surtain|CB': 96, 'Derek Stingley|CB': 94, 'Christian Gonzalez|CB': 92, 'Ahmad Gardner|CB': 91, 'Trent McDuffie|CB': 91, 'Devon Witherspoon|CB': 90,
  'Jaycee Horn|CB': 90, 'Quinyon Mitchell|CB': 89, 'Cooper DeJean|CB': 88, 'Denzel Ward|CB': 86, 'Jalen Ramsey|CB': 86, 'Marlon Humphrey|CB': 85,
  'Kamari Lassiter|CB': 84, 'Deommodore Lenoir|CB': 84, 'Joey Porter|CB': 83, 'Byron Murphy|CB': 83, 'D.J. Reed|CB': 82, 'Jamel Dean|CB': 82,
  'Tariq Woolen|CB': 82, 'Nate Wiggins|CB': 82, 'Christian Benford|CB': 82, 'D.J. Turner|CB': 82, 'Jourdan Lewis|CB': 80, 'Paulson Adebo|CB': 80,
  'Carlton Davis|CB': 79, 'Donte Jackson|CB': 78, 'Renardo Green|CB': 78, 'Cordale Flott|CB': 78, "Ja'Quan McMillian|CB": 78, 'Josh Jobe|CB': 76,
  'Chris Johnson|CB': 76, 'Maxwell Hairston|CB': 76, 'Michael Jackson|CB': 76, 'Montaric Brown|CB': 76, 'Mansoor Delane|CB': 76, 'Jarrian Jones|CB': 75,
  'James Pierre|CB': 74, 'Avieon Terrell|CB': 74, 'Brandon Cisse|CB': 72, 'Colton Hood|CB': 72,
  // S
  'Kyle Hamilton|S': 96, 'Derwin James|S': 91, 'Brian Branch|S': 90, 'Jessie Bates|S': 90, 'Antoine Winfield|S': 90, 'Xavier McKinney|S': 90,
  'Kerby Joseph|S': 88, 'Jalen Pitre|S': 85, 'Budda Baker|S': 85, 'Tre\'von Moehrig|S': 84, 'DeShon Elliott|S': 84, 'Justin Reid|S': 84,
  'Quentin Lake|S': 82, 'Julian Love|S': 82, 'Brandon Jones|S': 82, 'Josh Metellus|S': 82, 'Camryn Bynum|S': 82, 'Chauncey Gardner-Johnson|S': 82,
  'Grant Delpit|S': 82, 'Jevon Holland|S': 81, 'Antonio Johnson|S': 80, 'Calen Bullock|S': 80, 'Caleb Downs|S': 78, 'Tykee Smith|S': 78,
  'Cole Bishop|S': 78, 'Coby Bryant|S': 78, 'Dane Belton|S': 77, 'Nick Emmanwori|S': 77, 'Ar\'Darius Washington|S': 77, 'Dadrion Taylor-Demerson|S': 75,
  'Dillon Thieneman|S': 74, 'Treydan Stukes|S': 72,
  // K / P
  'Brandon Aubrey|K': 85, 'Ka\'imi Fairbairn|K': 84, 'Cameron Dicker|K': 84, 'Chris Boswell|K': 83, 'Will Reichard|K': 81, 'Nick Folk|K': 80,
};

/** A rookie's ceiling by draft slot when he isn't in the table: 82 for the first pick, ~72 by round three. */
export const rookieCeiling = (pick: number) => (pick > 0 ? Math.round(Math.max(68, 82 - (pick - 1) * 0.16)) : 70);
