"""{% t "한국어 문구" %} and {% t %}…{% endt %} render the English entry when the request language is English."""
from django import template
from django.utils.safestring import mark_safe

from webapp.i18n import t as translate

register = template.Library()


def _lang(context):
    request = context.get('request')
    return getattr(request, 'lang', context.get('lang', 'ko'))


@register.simple_tag(takes_context=True)
def t(context, text):
    return translate(text, _lang(context))


@register.tag('tblock')
def tblock(parser, token):
    nodelist = parser.parse(('endtblock',))
    parser.delete_first_token()
    return TBlockNode(nodelist)


class TBlockNode(template.Node):
    """The block body (which may contain inline HTML) is the key; the translation may contain the same HTML."""
    def __init__(self, nodelist):
        self.nodelist = nodelist

    def render(self, context):
        text = self.nodelist.render(context).strip()
        return mark_safe(translate(text, _lang(context)))
