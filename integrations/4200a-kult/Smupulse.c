/* KULT library DKTSsmu, module Smupulse. Description: DKTS_SMU_PULSE_ABI_1. */
#include <keithley.h>

int Smupulse(long drain, long gate, double start, double stop, long points,
             long onms, long offms, double gatev,
             double dlim, double dvr, double dir,
             double glim, double gvr, double gir, long token,
             double *vd, long vdsize, double *id, long idsize,
             double *elapsed, long elapsedsize, long *receipt)
{
    int d, g = 0, result = -1;
    char name[] = "SMU0";
    long n;
    double level, voltage, current, time;

    *receipt = 0;
    if (drain < 1 || drain > 8 || gate < 0 || gate > 8 || drain == gate ||
        points < 1 || points > 256 || vdsize != points || idsize != points ||
        elapsedsize != points || token <= 0 ||
        onms < 5 || onms > 20000 || offms < 5 || offms > 20000 ||
        points * (onms + offms) > 120000 ||
        !(start >= -21.0 && start <= 21.0 && stop >= -21.0 && stop <= 21.0) ||
        (points == 1 && start != stop) ||
        !(dlim > 0.0 && dlim <= dir && dir <= 1.0 && dvr > 0.0 && dvr <= 20.0))
        return -1;
    if (gate && !(gatev >= -21.0 && gatev <= 21.0 &&
        glim > 0.0 && glim <= gir && gir <= 1.0 && gvr > 0.0 && gvr <= 20.0))
        return -1;

    name[3] = (char)('0' + drain);
    if (getinstid(name, &d) != 0) return -2;
    if (gate) {
        name[3] = (char)('0' + gate);
        if (getinstid(name, &g) != 0) return -2;
    }

    /* EX initializes the system. Select ranges and program limits before bias. */
    if (rangev(d, dvr) || rangei(d, dir) || limiti(d, dlim))
        goto close_outputs;
    if (gate && (rangev(g, gvr) || rangei(g, gir) || limiti(g, glim) ||
                 forcev(g, gatev) || delay(offms)))
        goto close_outputs;
    if (enable(TIMER1)) goto close_outputs;

    for (n = 0; n < points; ++n) {
        level = n == points-1 ? stop :
            start + (stop - start) * n / (points - 1);
        if (mpulse(d, level, onms / 1000.0, &voltage, &current) ||
            meast(TIMER1, &time) || forcev(d, 0.0))
            goto close_outputs;
        vd[n] = voltage;
        id[n] = current;
        elapsed[n] = time;
        if (delay(offms)) goto close_outputs;
    }
    result = 0;

close_outputs:
    if (devint()) return -4;
    if (result == 0) *receipt = token;
    return result;
}
