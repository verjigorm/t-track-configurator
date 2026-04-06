// Knob / Thumbscrew — Parametric Model
// All dimensions in mm
//
// Orientation:
//   Bottom face (Z = 0) — nut/bolt head pocket faces down on the print bed
//   Top face    (Z = knob_thickness) — circular alignment nub on top
//
// Print with pocket facing down (no supports needed).

// --- Knob Shape ---
n_prongs       = 6;    // Number of prongs (2–100)
outer_diameter = 40;   // Diameter at prong tips, mm
valley_depth   = 5;    // Radial depth of valleys between prongs, mm
knob_thickness = 15;   // Body height, mm

// --- Bolt / Nut Dimensions ---
head_width     = 10;   // Hex head flat-to-flat (nut AF), mm
head_height    = 4;    // Hex head / nut thickness, mm
shaft_diameter = 6.5;  // Bolt shaft clearance diameter, mm

// --- Fixed ---
layer_height = 0.2;    // Bridge step height for support-free printing
knob_chamfer = 1;      // 45-degree chamfer depth on outer top/bottom edges, mm

// Derived
outer_radius = outer_diameter / 2;
inner_radius = outer_radius - valley_depth;
head_radius  = head_width / 2 / cos(30);

// 2D prong profile: cosine-wave outline so both prong tips AND valley bottoms
// are smoothly rounded — exactly like a wave.
// r(a) = inner_radius + valley_depth * (cos(a * n_prongs) + 1) / 2
//   at prong peak (cos = +1): r = outer_radius
//   at valley     (cos = -1): r = inner_radius
module knob_profile_2d() {
    steps = max(128, n_prongs * 32);
    pts = [for (i = [0 : steps - 1])
        let (a = i * 360 / steps,
             r = inner_radius + (outer_radius - inner_radius) * (cos(a * n_prongs) + 1) / 2)
        [r * cos(a), r * sin(a)]
    ];
    polygon(pts);
}

// Main knob body with 45-degree chamfer that follows the full wave contour —
// both prong tips AND valley bottoms are chamfered uniformly.
//
// Strategy: three stacked linear_extrudes.
//   bottom chamfer — scales the profile from s (inset) at z=0 to 1.0 at z=ch
//   middle body    — full profile, constant height
//   top chamfer    — scales from 1.0 at z=0 to s (inset) at z=ch
// where s = (outer_radius − ch) / outer_radius gives a 45° bevel referenced
// to the prong tip radius. The chamfer depth at inner points scales with r,
// deviating from a strict offset by < ch*(1−inner/outer) — less than 0.3 mm
// for the defaults — which is well within 3-D-printing tolerance.
module knob_body() {
    ch = knob_chamfer;
    s  = (outer_radius - ch) / outer_radius;   // scale factor for chamfer face

    union() {
        // Bottom chamfer: inset face at z=0, full face at z=ch
        linear_extrude(ch, scale = 1 / s)
        scale(s)
        knob_profile_2d();

        // Middle body
        translate([0, 0, ch])
        linear_extrude(knob_thickness - 2 * ch)
        knob_profile_2d();

        // Top chamfer: full face at z=0 (local), inset face at z=ch (local)
        translate([0, 0, knob_thickness - ch])
        linear_extrude(ch, scale = s)
        knob_profile_2d();
    }
}

// Circular alignment / tool-start nub on the top face.
// 1 mm thick, diameter = 2× shaft_diameter.
module top_protrusion() {
    translate([0, 0, knob_thickness])
    cylinder(h = 1, d = shaft_diameter * 2, $fn = 64);
}

// Hex pocket in the bottom face (receives bolt head or nut).
// Rotated 30° so two flat faces are parallel to ±X, minimising width used.
module hex_pocket() {
    translate([0, 0, -0.01])
    rotate([0, 0, 30])
    cylinder(h = head_height + 0.01, r = head_radius, $fn = 6);
}

// Clearance hole for bolt shaft through the full height (body + nub).
module shaft_hole() {
    translate([0, 0, -0.01])
    cylinder(h = knob_thickness + 1 + 0.02, d = shaft_diameter, $fn = 32);
}

// Bridging steps at the ceiling of the hex pocket — enable support-free printing.
module bridge_step() {
    // Slot spanning the full hex width, shaft-hole deep — lets the printer bridge.
    translate([-head_width/2, -shaft_diameter/2, head_height])
    cube([head_width, shaft_diameter, layer_height]);
}

module bridge_step_square() {
    // Second layer — square slot centred on the shaft axis.
    translate([-shaft_diameter/2, -shaft_diameter/2, head_height + layer_height])
    cube([shaft_diameter, shaft_diameter, layer_height]);
}

difference() {
    union() {
        knob_body();
        top_protrusion();
    }
    hex_pocket();
    shaft_hole();
    bridge_step();
    bridge_step_square();
}
