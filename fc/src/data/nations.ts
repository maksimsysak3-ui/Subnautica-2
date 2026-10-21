// Nation code -> [ISO flag code for flagcdn, display name, region]. Region drives generated
// names and the skin/hair distribution of procedurally drawn faces.
export type Region = 'brit' | 'iber' | 'germ' | 'ital' | 'fran' | 'nord' | 'east' | 'balk' | 'latam' | 'braz' | 'wafr' | 'nafr' | 'arab' | 'turk' | 'asia' | 'usa' | 'carib';
export const NATIONS: Record<string, [string, string, Region]> = {
  ENG: ['gb-eng', 'England', 'brit'], SCO: ['gb-sct', 'Scotland', 'brit'], WAL: ['gb-wls', 'Wales', 'brit'], NIR: ['gb-nir', 'Northern Ireland', 'brit'], IRL: ['ie', 'Ireland', 'brit'],
  ESP: ['es', 'Spain', 'iber'], POR: ['pt', 'Portugal', 'iber'], GER: ['de', 'Germany', 'germ'], AUT: ['at', 'Austria', 'germ'], SUI: ['ch', 'Switzerland', 'germ'],
  ITA: ['it', 'Italy', 'ital'], FRA: ['fr', 'France', 'fran'], BEL: ['be', 'Belgium', 'fran'], NED: ['nl', 'Netherlands', 'germ'], LUX: ['lu', 'Luxembourg', 'fran'],
  DEN: ['dk', 'Denmark', 'nord'], NOR: ['no', 'Norway', 'nord'], SWE: ['se', 'Sweden', 'nord'], FIN: ['fi', 'Finland', 'nord'], ISL: ['is', 'Iceland', 'nord'],
  POL: ['pl', 'Poland', 'east'], CZE: ['cz', 'Czechia', 'east'], SVK: ['sk', 'Slovakia', 'east'], HUN: ['hu', 'Hungary', 'east'], UKR: ['ua', 'Ukraine', 'east'], RUS: ['ru', 'Russia', 'east'], ROU: ['ro', 'Romania', 'east'], LTU: ['lt', 'Lithuania', 'east'], GEO: ['ge', 'Georgia', 'east'], ARM: ['am', 'Armenia', 'east'], UZB: ['uz', 'Uzbekistan', 'east'], BUL: ['bg', 'Bulgaria', 'balk'], ISR: ['il', 'Israel', 'arab'],
  CRO: ['hr', 'Croatia', 'balk'], SRB: ['rs', 'Serbia', 'balk'], SVN: ['si', 'Slovenia', 'balk'], BIH: ['ba', 'Bosnia & Herz.', 'balk'], MNE: ['me', 'Montenegro', 'balk'], ALB: ['al', 'Albania', 'balk'], KVX: ['xk', 'Kosovo', 'balk'], MKD: ['mk', 'North Macedonia', 'balk'], GRE: ['gr', 'Greece', 'balk'],
  TUR: ['tr', 'Türkiye', 'turk'],
  BRA: ['br', 'Brazil', 'braz'], ARG: ['ar', 'Argentina', 'latam'], URU: ['uy', 'Uruguay', 'latam'], COL: ['co', 'Colombia', 'latam'], ECU: ['ec', 'Ecuador', 'latam'], PAR: ['py', 'Paraguay', 'latam'], CHI: ['cl', 'Chile', 'latam'], MEX: ['mx', 'Mexico', 'latam'], VEN: ['ve', 'Venezuela', 'latam'], PER: ['pe', 'Peru', 'latam'], HON: ['hn', 'Honduras', 'latam'], PAN: ['pa', 'Panama', 'latam'], DOM: ['do', 'Dominican Rep.', 'carib'], EQG: ['gq', 'Equatorial Guinea', 'wafr'],
  USA: ['us', 'United States', 'usa'], CAN: ['ca', 'Canada', 'usa'], JAM: ['jm', 'Jamaica', 'carib'], HAI: ['ht', 'Haiti', 'carib'], GUF: ['gf', 'French Guiana', 'carib'],
  SEN: ['sn', 'Senegal', 'wafr'], CIV: ['ci', "Côte d'Ivoire", 'wafr'], NGA: ['ng', 'Nigeria', 'wafr'], GHA: ['gh', 'Ghana', 'wafr'], CMR: ['cm', 'Cameroon', 'wafr'], MLI: ['ml', 'Mali', 'wafr'], GUI: ['gn', 'Guinea', 'wafr'], BFA: ['bf', 'Burkina Faso', 'wafr'], COD: ['cd', 'DR Congo', 'wafr'], GAB: ['ga', 'Gabon', 'wafr'], GAM: ['gm', 'Gambia', 'wafr'], ANG: ['ao', 'Angola', 'wafr'], ZAM: ['zm', 'Zambia', 'wafr'], MOZ: ['mz', 'Mozambique', 'wafr'], TOG: ['tg', 'Togo', 'wafr'], BEN: ['bj', 'Benin', 'wafr'], CAF: ['cf', 'C. African Rep.', 'wafr'], CPV: ['cv', 'Cape Verde', 'wafr'], COM: ['km', 'Comoros', 'wafr'],
  MAR: ['ma', 'Morocco', 'nafr'], ALG: ['dz', 'Algeria', 'nafr'], TUN: ['tn', 'Tunisia', 'nafr'], EGY: ['eg', 'Egypt', 'nafr'],
  KSA: ['sa', 'Saudi Arabia', 'arab'], JOR: ['jo', 'Jordan', 'arab'],
  JPN: ['jp', 'Japan', 'asia'], KOR: ['kr', 'Korea Republic', 'asia'], IDN: ['id', 'Indonesia', 'asia'], AUS: ['au', 'Australia', 'brit'], NZL: ['nz', 'New Zealand', 'brit'],
};

export const COUNTRY_NAT: Record<string, string> = {
  england: 'ENG', spain: 'ESP', germany: 'GER', italy: 'ITA', france: 'FRA', portugal: 'POR', netherlands: 'NED', scotland: 'SCO', turkey: 'TUR',
  'saudi-arabia': 'KSA', usa: 'USA', belgium: 'BEL', austria: 'AUT', greece: 'GRE', 'czech-republic': 'CZE', denmark: 'DEN', serbia: 'SRB', croatia: 'CRO',
  switzerland: 'SUI', ukraine: 'UKR', norway: 'NOR', brazil: 'BRA', argentina: 'ARG',
};

const N = (s: string) => s.split(' ');
export const NAMES: Partial<Record<Region, [string[], string[]]>> = {
  brit: [N('James Jack Harry Charlie Oliver George Alfie Lewis Callum Ryan Josh Kieran Tom Ben Sam Luke Connor Dan Jordan Liam Ethan Mason Tyler Rhys Owen Jamie Finn Reece Jake Archie'), N('Smith Jones Taylor Brown Wilson Evans Walker Wright Thompson Robinson Clarke Hughes Hall Ward Turner Cooper Hill Morris Bennett Shaw Palmer Kelly Murphy Doyle Campbell Stewart Fraser Hunter Morgan Price Barnes Lloyd Mitchell Whitaker Fletcher')],
  iber: [N('Pablo Sergio Álvaro Javi Diego Adrián Hugo Marcos Iker Raúl Unai Jon Rubén Carlos Dani Mario Alejandro Rodrigo Gonçalo Tiago Rafa Nuno Óscar Víctor Íñigo Asier Aitor Pedro'), N('García Fernández González Rodríguez López Martínez Sánchez Pérez Gómez Martín Ruiz Hernández Jiménez Díaz Moreno Muñoz Álvarez Romero Navarro Torres Domínguez Gil Vázquez Serrano Ramos Blanco Molina Castro Ortega Silva Costa Pereira Ferreira Santos Lopes')],
  germ: [N('Lukas Jonas Leon Finn Niklas Tim Felix Paul Jan Moritz Luca Julian Tom Max Noah Elias Florian Kevin Dennis Marvin Lars Daan Jesse Thijs Sem Bram Joris'), N('Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Richter Klein Wolf Neumann Schwarz Braun Zimmermann Krüger Hartmann Lange Werner Krause de Vries Jansen Bakker Visser Smit de Boer Mulder Bos')],
  ital: [N('Lorenzo Matteo Alessandro Andrea Federico Davide Riccardo Gabriele Simone Tommaso Marco Luca Nicolò Filippo Giacomo Michele Pietro Daniele Stefano Giorgio Edoardo Mattia'), N('Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De Luca Costa Giordano Mancini Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Leone Longo')],
  fran: [N('Lucas Hugo Théo Nathan Mathis Enzo Louis Tom Maxime Antoine Clément Baptiste Alexis Romain Quentin Yanis Kylian Rayan Mathéo Jules Adrien Florian Benjamin Bastien'), N('Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard André Lefèvre Mercier Dupont Lambert Bonnet François Martinez Peeters Janssens')],
  nord: [N('Oscar William Lucas Elias Oliver Emil Magnus Jonas Mathias Kasper Mikkel Viktor Isak Erik Anders Sander Henrik Rasmus Jesper Aksel Linus'), N('Hansen Johansen Olsen Larsen Andersen Pedersen Nilsen Jensen Nielsen Christensen Johansson Andersson Karlsson Nilsson Eriksson Lindqvist Berg Haugen Dahl Lund Holm Strand Sørensen')],
  east: [N('Jakub Kacper Mateusz Szymon Filip Adam Tomáš Marek Lukáš Patrik Dominik Ádám Bence Oleksandr Mykola Andriy Dmytro Ivan Mihai Andrei Vlad Giorgi Luka'), N('Nowak Kowalski Wiśniewski Wójcik Kamiński Lewandowski Zieliński Szymański Novák Svoboda Dvořák Černý Horváth Nagy Tóth Kovalenko Shevchenko Bondarenko Popescu Ionescu Stan Kvaratskhelia Beridze')],
  balk: [N('Luka Marko Ivan Nikola Stefan Filip Josip Mateo Petar Dušan Aleksandar Lazar Milan Andrej Ante Toni Edin Armin Kristjan Giorgos Dimitris Nikos'), N('Horvat Kovačević Babić Marić Jurić Novak Petrović Jovanović Nikolić Marković Đorđević Stojanović Ilić Pavlović Popović Hodžić Begić Krasniqi Papadopoulos Georgiou Nikolaidis Ivanov')],
  turk: [N('Emre Mert Burak Can Arda Kerem Yusuf Ozan Barış Hakan Oğuz Eren Kaan Furkan Berkay Ahmet Mehmet Cenk'), N('Yılmaz Kaya Demir Şahin Çelik Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Doğan Kılıç Aslan Çetin Kara Koç Kurt Akgün Güler')],
  latam: [N('Santiago Mateo Matías Nicolás Facundo Thiago Lautaro Agustín Joaquín Franco Tomás Juan Valentín Sebastián Felipe Andrés Cristian Brian Kevin Luis Jhon Alexis'), N('González Rodríguez Gómez Fernández López Díaz Martínez Pérez Romero Sosa Álvarez Torres Ruiz Ramírez Flores Benítez Acosta Medina Herrera Suárez Aguirre Giménez Gutiérrez Cabrera Ríos Vargas Castillo')],
  braz: [N('Gabriel Lucas Matheus Pedro Guilherme Rafael Felipe Bruno Vinícius Thiago Gustavo João Caio Igor Renan Wesley Danilo Éverton Douglas Murilo Kauã Endrick'), N('Silva Santos Oliveira Souza Lima Pereira Costa Rodrigues Almeida Nascimento Araújo Ribeiro Carvalho Gomes Martins Rocha Barbosa Moreira Cardoso Teixeira Mendes Vieira Freitas')],
  wafr: [N('Ibrahim Moussa Abdoulaye Mamadou Cheikh Ousmane Yaya Seydou Amadou Samuel Emmanuel Victor Kelechi Chukwuemeka Kwame Kofi Yaw Jean Christian Pape Lamine Boubacar Wilfried Serge'), N('Diallo Traoré Koné Coulibaly Camara Diop Ndiaye Sow Cissé Touré Keita Sangaré Okafor Eze Osei Mensah Boateng Asante Mbappé Ekambi Kouassi Bamba Yao Fofana Sarr')],
  nafr: [N('Youssef Mohamed Amine Achraf Hakim Sofiane Riyad Ismaël Bilal Hamza Ayoub Ilias Omar Karim Mehdi Nabil Walid Anis Rayan'), N('El Idrissi Benali Bennani Amrani Haddad Mansouri Belkacem Saadi Ziani Bensaïd Brahimi Hamdi Salah Hassan Ali Ibrahim Mahmoud Trabelsi Jaziri Ben Youssef')],
  arab: [N('Abdullah Fahad Saud Salem Faisal Nasser Mohammed Abdulrahman Turki Sultan Khalid Ali Hassan Yasser Nawaf'), N('Al-Dawsari Al-Shehri Al-Ghannam Al-Faraj Al-Owais Al-Bulaihi Al-Tambakti Kanno Al-Malki Al-Hamdan Al-Amri Al-Harbi Al-Qahtani Al-Otaibi')],
  asia: [N('Takumi Kaoru Ritsu Daichi Ko Yuki Hiroki Wataru Ao Kenta Sota Min-jae Heung-min Kang-in Jae-sung Seung-ho Hee-chan'), N('Tanaka Suzuki Takahashi Watanabe Ito Yamamoto Nakamura Kobayashi Sato Kato Yoshida Kim Lee Park Choi Jung Kang Cho Yoon Hwang')],
  usa: [N('Tyler Brandon Christian Josh Weston Gio Brenden Caleb Gianluca Malik Folarin Haji Jordan Miles Cameron Aidan'), N('Adams Pulisic McKennie Reyna Robinson Dest Tillman Johnson Williams Miller Davis Wilson Anderson Moore Jackson White Harris Clark Lewis Young')],
  carib: [N('Leon Shamar Andre Bobby Kemar Romario Darren Kasey Jamal'), N('Bailey Reid Campbell Gordon Nicholson Lowe Palmer Grant Francis')],
};
export const regionOf = (nat: string): Region => NATIONS[nat]?.[2] ?? 'brit';
export const flagUrl = (nat: string) => NATIONS[nat] ? `https://flagcdn.com/w40/${NATIONS[nat][0]}.png` : '';
export const natName = (nat: string) => NATIONS[nat]?.[1] ?? nat;

/** Typical nationality mix of generated players per club country. */
export const NAT_MIX: Record<string, [string, number][]> = {
  ENG: [['ENG', 50], ['IRL', 4], ['SCO', 4], ['WAL', 3], ['FRA', 4], ['NED', 3], ['BRA', 3], ['NGA', 3], ['GHA', 3], ['ESP', 3], ['POR', 3], ['DEN', 2], ['BEL', 3], ['JAM', 2], ['USA', 2], ['SEN', 2], ['CIV', 2], ['NOR', 2], ['SWE', 2]],
  ESP: [['ESP', 72], ['ARG', 5], ['URU', 3], ['BRA', 3], ['FRA', 3], ['MAR', 3], ['POR', 2], ['COL', 2], ['SEN', 2], ['CRO', 1]],
  GER: [['GER', 55], ['AUT', 7], ['SUI', 5], ['NED', 4], ['DEN', 3], ['FRA', 4], ['POL', 3], ['CRO', 3], ['TUR', 3], ['JPN', 3], ['USA', 2], ['GHA', 2], ['CIV', 2], ['BEL', 2]],
  ITA: [['ITA', 58], ['ARG', 4], ['BRA', 4], ['FRA', 4], ['SRB', 3], ['CRO', 3], ['NED', 3], ['DEN', 3], ['POL', 3], ['NGA', 2], ['SEN', 2], ['ALB', 2], ['URU', 2], ['BEL', 2]],
  FRA: [['FRA', 60], ['SEN', 6], ['CIV', 5], ['MAR', 4], ['ALG', 4], ['MLI', 3], ['CMR', 3], ['BEL', 3], ['BRA', 2], ['GUI', 2], ['POR', 2], ['TUN', 2], ['COD', 2]],
};
