#!/usr/bin/perl
use strict;
use warnings;
use JSON;
use List::Util qw(sum);
use FindBin;

sub decode_traffic {
    my $traffic = shift;
    my %fac = (gb => 1024**3,
               mb => 1024**2,
               kb => 1024**1,
               b  => 1024**0);
    if ($traffic =~ /^(\d+) (\w+)$/) {
        die "Unknown unit $2" unless exists $fac{lc $2};
        return $1 * $fac{lc $2};
    } else {
        die "Unable to parse '$traffic'";
    }
}

my $date = $ARGV[0] or die "Usage: $0 <since>\n";

open(my $fh, "-|", "phantomjs", "$FindBin::Bin/getevn.js", $date)
    or die "Unable to run getevn.js: $!";
my $json;
while (<$fh>) {
    if (/^\[/) {
        warn "JSON data received twice?" if $json;
        $json = $_;
    } else {
        print;
    }
}
close $fh or die $! ? "Error closing getevn pipe: $!"
                    : "Exit status $? from getevn";

my $total = sum(map { decode_traffic($_->{Volumen}) } @{decode_json($json)});
printf("%d MB traffic used since %s\n", $total/1024/1024, $date);
