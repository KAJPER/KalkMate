#pragma once
// =====================================================================
//  offline_solver.h — lokalne (bez WiFi/serwera) rozwiazywanie prostych
//  zadan maturalnych: rownania liniowe/kwadratowe, uklady 2 rownan,
//  procenty/proporcje, pochodne wielomianow.
//
//  Czysta logika matematyczna — zero zaleznosci od U8G2/hardware,
//  zeby dalo sie ja zweryfikowac niezaleznie od UI.
// =====================================================================

#include <math.h>
#include <string.h>
#include <stdio.h>

struct LinearResult {
    bool infinite;   // a==0 && b==0
    bool none;       // a==0 && b!=0
    double x;
};

struct QuadraticResult {
    bool usedLinear;   // a==0 -> policzono jako liniowe (bx+c=0)
    LinearResult linear;
    int realRoots;     // 0 (zespolone), 1 (podwojny), 2
    double delta;
    double x1, x2;     // wazne gdy realRoots >= 1
    double reP, imP;    // czesc rzeczywista/urojona gdy realRoots == 0
};

struct System2x2Result {
    bool none;
    bool infinite;
    double x, y;
};

static inline LinearResult offlineSolveLinear(double a, double b) {
    LinearResult r{ false, false, 0.0 };
    if (a == 0.0) {
        if (b == 0.0) r.infinite = true;
        else          r.none = true;
        return r;
    }
    r.x = -b / a;
    return r;
}

static inline QuadraticResult offlineSolveQuadratic(double a, double b, double c) {
    QuadraticResult r{};
    if (a == 0.0) {
        r.usedLinear = true;
        r.linear = offlineSolveLinear(b, c);
        return r;
    }
    r.delta = b * b - 4.0 * a * c;
    if (r.delta > 0.0) {
        double sq = sqrt(r.delta);
        r.realRoots = 2;
        r.x1 = (-b + sq) / (2.0 * a);
        r.x2 = (-b - sq) / (2.0 * a);
    } else if (r.delta == 0.0) {
        r.realRoots = 1;
        r.x1 = r.x2 = -b / (2.0 * a);
    } else {
        r.realRoots = 0;
        r.reP = -b / (2.0 * a);
        r.imP = sqrt(-r.delta) / (2.0 * a);
    }
    return r;
}

static inline System2x2Result offlineSolveSystem2x2(double a1, double b1, double c1,
                                                     double a2, double b2, double c2) {
    System2x2Result r{ false, false, 0.0, 0.0 };
    double w  = a1 * b2 - a2 * b1;
    double wx = c1 * b2 - c2 * b1;
    double wy = a1 * c2 - a2 * c1;
    if (w == 0.0) {
        if (wx == 0.0 && wy == 0.0) r.infinite = true;
        else                        r.none = true;
        return r;
    }
    r.x = wx / w;
    r.y = wy / w;
    return r;
}

// X% z Y
static inline double offlinePercentOf(double pct, double base) {
    return base * pct / 100.0;
}

// Y to ile % z X
static inline double offlinePercentWhat(double part, double whole) {
    if (whole == 0.0) return NAN;
    return part / whole * 100.0;
}

// a:b = c:x  ->  x = (b*c)/a
static inline double offlineProportion(double a, double b, double c) {
    if (a == 0.0) return NAN;
    return (b * c) / a;
}

// coeffs[0..degree] = a0 + a1*x + ... + a_degree*x^degree
// Wypelnia outCoeffs[0..degree-1] (pochodna). Zwraca stopien pochodnej
// (degree-1), albo -1 jesli degree <= 0 (pochodna stalej = 0, brak sensownego
// wyniku do pokazania jako wielomian).
static inline int offlinePolyDerivative(const double* coeffs, int degree, double* outCoeffs) {
    if (degree <= 0) return -1;
    for (int i = 1; i <= degree; i++) {
        outCoeffs[i - 1] = coeffs[i] * i;
    }
    return degree - 1;
}

// --- Punkty na plaszczyznie: odleglosc |AB| + srodek odcinka ---
struct PointsResult {
    double distance;
    double midX, midY;
};

static inline PointsResult offlinePointsCalc(double x1, double y1, double x2, double y2) {
    PointsResult r;
    double dx = x2 - x1, dy = y2 - y1;
    r.distance = sqrt(dx * dx + dy * dy);
    r.midX = (x1 + x2) / 2.0;
    r.midY = (y1 + y2) / 2.0;
    return r;
}

// --- Twierdzenie Pitagorasa ---
struct PythagorasResult {
    bool valid;    // false gdy dane sprzeczne (np. przeciwprostokatna <= przyprostokatnej)
    double result;
};

static inline PythagorasResult offlinePythagorasHypotenuse(double a, double b) {
    return PythagorasResult{ true, sqrt(a * a + b * b) };
}

static inline PythagorasResult offlinePythagorasLeg(double c, double a) {
    double v = c * c - a * a;
    if (v <= 0.0) return PythagorasResult{ false, 0.0 };
    return PythagorasResult{ true, sqrt(v) };
}

// --- Ciagi arytmetyczne i geometryczne ---
struct SequenceResult {
    double nthTerm;
    double sumN;
};

static inline SequenceResult offlineArithmeticSeq(double a1, double r, int n) {
    SequenceResult res;
    res.nthTerm = a1 + (n - 1) * r;
    res.sumN = n * (a1 + res.nthTerm) / 2.0;
    return res;
}

static inline SequenceResult offlineGeometricSeq(double a1, double q, int n) {
    SequenceResult res;
    res.nthTerm = a1 * pow(q, n - 1);
    if (q == 1.0) res.sumN = a1 * n;
    else          res.sumN = a1 * (1.0 - pow(q, n)) / (1.0 - q);
    return res;
}

// --- Pola i obwody podstawowych figur ---
#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

struct AreaResult {
    bool valid;         // false gdy np. boki nie tworza trojkata
    double area;
    double perimeter;
    bool hasPerimeter;   // false gdy obwodu nie da sie policzyc z podanych danych (trapez bez ramion)
};

static inline AreaResult offlineRectangle(double a, double b) {
    return AreaResult{ true, a * b, 2.0 * (a + b), true };
}

static inline AreaResult offlineTriangleHeron(double a, double b, double c) {
    if (a <= 0.0 || b <= 0.0 || c <= 0.0) return AreaResult{ false, 0, 0, true };
    if (a + b <= c || a + c <= b || b + c <= a) return AreaResult{ false, 0, 0, true };
    double p = (a + b + c) / 2.0;
    return AreaResult{ true, sqrt(p * (p - a) * (p - b) * (p - c)), a + b + c, true };
}

static inline AreaResult offlineCircle(double radius) {
    return AreaResult{ true, M_PI * radius * radius, 2.0 * M_PI * radius, true };
}

static inline AreaResult offlineTrapezoid(double a, double b, double h) {
    // Obwod wymaga dlugosci ramion (nie podanych tutaj) — tylko pole.
    return AreaResult{ true, (a + b) / 2.0 * h, 0.0, false };
}

// Formatuje liczbe bez zbednych zer po przecinku (kopia logiki z
// calculator.h _calcFormat, bez zaleznosci na ten naglowek).
static inline void offlineFmtNum(double v, char* buf, size_t bufSize) {
    if (isnan(v) || isinf(v)) {
        strncpy(buf, "Error", bufSize - 1);
        buf[bufSize - 1] = '\0';
        return;
    }
    if (v == (long long)v && fabs(v) < 1e10) {
        snprintf(buf, bufSize, "%lld", (long long)v);
        return;
    }
    snprintf(buf, bufSize, "%.6g", v);
    char* dot = strchr(buf, '.');
    if (dot) {
        char* end = buf + strlen(buf) - 1;
        while (end > dot && *end == '0') *end-- = '\0';
        if (end == dot) *end = '\0';
    }
}
