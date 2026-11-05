#pragma once
class Print;
class Printable { public: virtual ~Printable() {} virtual size_t printTo(Print &p) const = 0; };
